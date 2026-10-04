"""Shared Redis-backed limits for expensive public API operations."""

import hashlib
import hmac
import logging
import os
import threading
import time
from dataclasses import dataclass

from fastapi import HTTPException, Request, status
from prometheus_client import Counter
from redis import Redis
from redis.exceptions import RedisError


logger = logging.getLogger(__name__)

rate_limit_operations = Counter(
    "rate_limit_operations_total",
    "Rate limit decisions by scope and result.",
    ("scope", "result"),
)


def _positive_int_env(name: str, default: int) -> int:
    raw_value = os.getenv(name, str(default))
    try:
        value = int(raw_value)
    except ValueError as exc:
        raise RuntimeError(f"{name} must be an integer") from exc
    if value < 1:
        raise RuntimeError(f"{name} must be greater than zero")
    return value


def _bool_env(name: str, default: bool) -> bool:
    return os.getenv(name, str(default)).strip().lower() in {"1", "true", "yes"}


@dataclass(frozen=True)
class RateLimitDecision:
    allowed: bool
    retry_after: int
    source: str


class _LocalFallback:
    """Conservative per-Pod fallback used only when Redis is unavailable."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._windows: dict[str, tuple[int, int]] = {}

    def check(self, key: str, limit: int, window_seconds: int) -> RateLimitDecision:
        now = int(time.time())
        window_start = now - (now % window_seconds)
        with self._lock:
            count, current_window = self._windows.get(key, (0, window_start))
            if current_window != window_start:
                count = 0
            count += 1
            self._windows[key] = (count, window_start)
        return RateLimitDecision(
            allowed=count <= limit,
            retry_after=max(1, window_start + window_seconds - now),
            source="local_fallback",
        )


class RateLimiter:
    """Use Redis atomically and degrade to a smaller local fixed-window limit."""

    _script = """
local current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return current
"""

    def __init__(self) -> None:
        self.enabled = _bool_env("RATE_LIMIT_ENABLED", False)
        self.trust_proxy_headers = _bool_env("RATE_LIMIT_TRUST_PROXY_HEADERS", False)
        self.fallback_pod_count = _positive_int_env(
            "RATE_LIMIT_FALLBACK_POD_COUNT",
            6,
        )
        self.key_secret = os.getenv("RATE_LIMIT_KEY_SECRET") or os.getenv("SECRET_KEY", "")
        self.client: Redis | None = None
        redis_url = os.getenv("REDIS_URL", "").strip()
        if self.enabled and redis_url:
            self.client = Redis.from_url(
                redis_url,
                decode_responses=True,
                socket_connect_timeout=1,
                socket_timeout=1,
                health_check_interval=30,
            )
        self.local_fallback = _LocalFallback()

    def _hash_identity(self, value: str) -> str:
        return hmac.new(
            self.key_secret.encode("utf-8"),
            value.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()[:32]

    def client_identity(self, request: Request) -> str:
        if self.trust_proxy_headers:
            forwarded = request.headers.get("x-forwarded-for", "")
            if forwarded:
                return forwarded.split(",", maxsplit=1)[0].strip()
        return request.client.host if request.client else "unknown"

    def check(
        self,
        *,
        request: Request,
        scope: str,
        limit: int,
        window_seconds: int,
        identity: str | None = None,
    ) -> RateLimitDecision:
        if not self.enabled:
            rate_limit_operations.labels(scope, "disabled").inc()
            return RateLimitDecision(True, 0, "disabled")

        raw_identity = identity or self.client_identity(request)
        key = f"philobiblus:ratelimit:{scope}:{self._hash_identity(raw_identity)}"
        if self.client:
            try:
                current = int(self.client.eval(self._script, 1, key, window_seconds))
                ttl = self.client.ttl(key)
                decision = RateLimitDecision(
                    allowed=current <= limit,
                    retry_after=max(1, ttl if ttl > 0 else window_seconds),
                    source="redis",
                )
                rate_limit_operations.labels(
                    scope,
                    "allowed" if decision.allowed else "rejected",
                ).inc()
                return decision
            except (RedisError, ValueError) as exc:
                logger.warning("Rate limiter Redis operation failed: %s", exc)
                rate_limit_operations.labels(scope, "redis_error").inc()

        per_pod_limit = max(1, limit // self.fallback_pod_count)
        decision = self.local_fallback.check(key, per_pod_limit, window_seconds)
        rate_limit_operations.labels(
            scope,
            "fallback_allowed" if decision.allowed else "fallback_rejected",
        ).inc()
        return decision


rate_limiter = RateLimiter()


def enforce_rate_limit(
    *,
    request: Request,
    scope: str,
    limit: int,
    window_seconds: int,
    identity: str | None = None,
) -> None:
    decision = rate_limiter.check(
        request=request,
        scope=scope,
        limit=limit,
        window_seconds=window_seconds,
        identity=identity,
    )
    if decision.allowed:
        return
    raise HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail="Too many requests. Please retry later.",
        headers={
            "Retry-After": str(decision.retry_after),
            "X-RateLimit-Source": decision.source,
        },
    )

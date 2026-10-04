import hashlib
import json
import logging
import os
from typing import Any, Optional

from prometheus_client import Counter
from redis import Redis
from redis.exceptions import RedisError


logger = logging.getLogger(__name__)

catalog_cache_operations = Counter(
    "catalog_cache_operations_total",
    "Catalogue cache operations by operation and result.",
    ("operation", "result"),
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


class CatalogCache:
    """Best-effort shared cache for anonymous public catalogue responses."""

    _version_key = "philobiblus:catalog:version"

    def __init__(self) -> None:
        redis_url = os.getenv("REDIS_URL", "").strip()
        self.ttl_seconds = _positive_int_env("CATALOG_CACHE_TTL_SECONDS", 30)
        self.client: Optional[Redis] = None
        if redis_url:
            self.client = Redis.from_url(
                redis_url,
                decode_responses=True,
                socket_connect_timeout=1,
                socket_timeout=1,
                health_check_interval=30,
            )

    @property
    def enabled(self) -> bool:
        return self.client is not None

    def _cache_key(self, parameters: dict[str, Any]) -> Optional[str]:
        if not self.client:
            return None
        try:
            version = self.client.get(self._version_key) or "0"
        except RedisError as exc:
            logger.warning("Catalogue cache version lookup failed: %s", exc)
            return None
        encoded = json.dumps(parameters, sort_keys=True, separators=(",", ":"))
        digest = hashlib.sha256(encoded.encode("utf-8")).hexdigest()
        return f"philobiblus:catalog:v{version}:{digest}"

    def get(self, parameters: dict[str, Any]) -> Optional[list[dict[str, Any]]]:
        if not self.client:
            catalog_cache_operations.labels("get", "disabled").inc()
            return None
        key = self._cache_key(parameters)
        if not key:
            catalog_cache_operations.labels("get", "error").inc()
            return None
        try:
            value = self.client.get(key)
            result = json.loads(value) if value is not None else None
            catalog_cache_operations.labels(
                "get",
                "hit" if result is not None else "miss",
            ).inc()
            return result
        except (RedisError, json.JSONDecodeError) as exc:
            logger.warning("Catalogue cache read failed: %s", exc)
            catalog_cache_operations.labels("get", "error").inc()
            return None

    def set(self, parameters: dict[str, Any], value: list[dict[str, Any]]) -> None:
        key = self._cache_key(parameters)
        if not key or not self.client:
            catalog_cache_operations.labels(
                "set",
                "disabled" if not self.client else "error",
            ).inc()
            return
        try:
            self.client.setex(
                key,
                self.ttl_seconds,
                json.dumps(value, separators=(",", ":")),
            )
            catalog_cache_operations.labels("set", "success").inc()
        except RedisError as exc:
            logger.warning("Catalogue cache write failed: %s", exc)
            catalog_cache_operations.labels("set", "error").inc()

    def invalidate(self) -> None:
        """Invalidate cached pages across all backend Pods without key scans."""
        if not self.client:
            catalog_cache_operations.labels("invalidate", "disabled").inc()
            return
        try:
            self.client.incr(self._version_key)
            catalog_cache_operations.labels("invalidate", "success").inc()
        except RedisError as exc:
            logger.warning("Catalogue cache invalidation failed: %s", exc)
            catalog_cache_operations.labels("invalidate", "error").inc()


catalog_cache = CatalogCache()

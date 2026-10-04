from types import SimpleNamespace

from app.rate_limit import RateLimiter


class FakeRedis:
    def __init__(self):
        self.values = {}

    def eval(self, script, key_count, key, window_seconds):
        count = int(self.values.get(key, 0)) + 1
        self.values[key] = count
        self.values[f"ttl:{key}"] = int(window_seconds)
        return count

    def ttl(self, key):
        return self.values.get(f"ttl:{key}", -1)


def test_redis_rate_limit_rejects_after_the_configured_limit(monkeypatch):
    monkeypatch.setenv("RATE_LIMIT_ENABLED", "true")
    monkeypatch.setenv("RATE_LIMIT_KEY_SECRET", "test-rate-limit-key")
    limiter = RateLimiter()
    limiter.client = FakeRedis()
    request = SimpleNamespace(
        headers={},
        client=SimpleNamespace(host="198.51.100.10"),
    )

    decisions = [
        limiter.check(
            request=request,
            scope="login",
            limit=2,
            window_seconds=60,
            identity="198.51.100.10:testuser",
        )
        for _ in range(3)
    ]

    assert [decision.allowed for decision in decisions] == [True, True, False]
    assert decisions[-1].retry_after == 60
    assert decisions[-1].source == "redis"

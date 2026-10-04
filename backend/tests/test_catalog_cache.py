import json

from app.catalog_cache import CatalogCache


class FakeRedis:
    def __init__(self):
        self.values = {}

    def get(self, key):
        return self.values.get(key)

    def setex(self, key, ttl, value):
        self.values[key] = value
        self.values[f"ttl:{key}"] = ttl

    def incr(self, key):
        value = int(self.values.get(key, "0")) + 1
        self.values[key] = str(value)
        return value


def test_catalog_cache_reuses_a_normalized_query_key(monkeypatch):
    monkeypatch.delenv("REDIS_URL", raising=False)
    cache = CatalogCache()
    cache.client = FakeRedis()

    parameters = {"search": None, "genre": "history", "skip": 0, "limit": 20}
    payload = [{"id": 1, "title": "A cached book"}]

    cache.set(parameters, payload)

    assert cache.get(dict(reversed(list(parameters.items())))) == payload
    stored_payloads = [
        value
        for key, value in cache.client.values.items()
        if key.startswith("philobiblus:catalog:v")
    ]
    assert json.loads(stored_payloads[0]) == payload


def test_catalog_cache_invalidation_changes_the_generation(monkeypatch):
    monkeypatch.delenv("REDIS_URL", raising=False)
    cache = CatalogCache()
    cache.client = FakeRedis()
    parameters = {"search": None, "genre": None, "skip": 0, "limit": 20}

    cache.set(parameters, [{"id": 1}])
    assert cache.get(parameters) == [{"id": 1}]

    cache.invalidate()

    assert cache.get(parameters) is None

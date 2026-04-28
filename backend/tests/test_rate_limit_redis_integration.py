import os
from datetime import datetime, timezone
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.core.config import settings
from app.core import rate_limit as rate_limit_module
from app.core.rate_limit import clear_rate_limits, enforce_rate_limit


def _ensure_redis_or_skip(redis_url: str) -> None:
    try:
        import redis

        client = redis.Redis.from_url(redis_url, decode_responses=True)
        client.ping()
    except Exception as exc:
        pytest.skip(f"Redis is unavailable for integration test: {exc}")


@pytest.fixture(autouse=True)
def isolate_rate_limit_store(monkeypatch):
    # Reset cached backend/store to ensure each test gets fresh configuration.
    monkeypatch.setattr(rate_limit_module, "_STORE", None)
    monkeypatch.setattr(rate_limit_module, "_STORE_BACKEND", None)
    yield
    monkeypatch.setattr(rate_limit_module, "_STORE", None)
    monkeypatch.setattr(rate_limit_module, "_STORE_BACKEND", None)


def test_redis_backend_enforces_limit_and_headers(monkeypatch):
    redis_url = os.getenv("TEST_REDIS_URL", "redis://localhost:6379/15")
    _ensure_redis_or_skip(redis_url)

    monkeypatch.setattr(settings, "RATE_LIMIT_BACKEND", "redis")
    monkeypatch.setattr(settings, "RATE_LIMIT_REDIS_URL", redis_url)
    monkeypatch.setattr(settings, "RATE_LIMIT_REDIS_KEY_PREFIX", f"rl-test-{uuid4().hex}")

    clear_rate_limits()
    now = datetime(2044, 1, 1, tzinfo=timezone.utc)

    enforce_rate_limit(actor_id=101, scope="integration", limit_per_minute=2, now=now)
    enforce_rate_limit(actor_id=101, scope="integration", limit_per_minute=2, now=now)

    with pytest.raises(HTTPException) as exc:
        enforce_rate_limit(actor_id=101, scope="integration", limit_per_minute=2, now=now)

    err = exc.value
    assert err.status_code == 429
    assert err.headers is not None
    assert err.headers.get("X-RateLimit-Limit") == "2"
    assert err.headers.get("X-RateLimit-Remaining") == "0"
    assert err.headers.get("Retry-After") is not None


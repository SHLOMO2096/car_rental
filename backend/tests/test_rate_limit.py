from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException

from app.core.config import settings
from app.core.rate_limit import clear_rate_limits, enforce_rate_limit


def test_enforce_rate_limit_allows_until_limit_then_blocks_with_headers():
    clear_rate_limits()
    now = datetime(2044, 1, 1, tzinfo=timezone.utc)

    enforce_rate_limit(actor_id=1, scope="suggestions:search", limit_per_minute=2, now=now)
    enforce_rate_limit(actor_id=1, scope="suggestions:search", limit_per_minute=2, now=now)

    with pytest.raises(HTTPException) as exc:
        enforce_rate_limit(actor_id=1, scope="suggestions:search", limit_per_minute=2, now=now)

    err = exc.value
    assert err.status_code == 429
    assert err.headers is not None
    assert err.headers.get("Retry-After") == "60"
    assert err.headers.get("X-RateLimit-Limit") == "2"
    assert err.headers.get("X-RateLimit-Remaining") == "0"
    assert err.headers.get("X-RateLimit-Window") == "60"


def test_enforce_rate_limit_releases_after_window_passes():
    clear_rate_limits()
    now = datetime(2044, 1, 1, tzinfo=timezone.utc)

    enforce_rate_limit(actor_id=7, scope="suggestions:apply", limit_per_minute=1, now=now)
    with pytest.raises(HTTPException):
        enforce_rate_limit(actor_id=7, scope="suggestions:apply", limit_per_minute=1, now=now)

    after_window = now + timedelta(seconds=61)
    enforce_rate_limit(actor_id=7, scope="suggestions:apply", limit_per_minute=1, now=after_window)


def test_clear_rate_limits_resets_bucket_state():
    clear_rate_limits()
    now = datetime(2044, 1, 1, tzinfo=timezone.utc)

    enforce_rate_limit(actor_id=9, scope="x", limit_per_minute=1, now=now)
    with pytest.raises(HTTPException):
        enforce_rate_limit(actor_id=9, scope="x", limit_per_minute=1, now=now)

    clear_rate_limits()
    enforce_rate_limit(actor_id=9, scope="x", limit_per_minute=1, now=now)


def test_unsupported_backend_falls_back_to_memory(monkeypatch):
    clear_rate_limits()
    monkeypatch.setattr(settings, "RATE_LIMIT_BACKEND", "bogus")
    now = datetime(2044, 1, 1, tzinfo=timezone.utc)

    enforce_rate_limit(actor_id=11, scope="fallback", limit_per_minute=1, now=now)
    with pytest.raises(HTTPException) as exc:
        enforce_rate_limit(actor_id=11, scope="fallback", limit_per_minute=1, now=now)

    assert exc.value.status_code == 429



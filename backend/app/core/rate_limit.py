from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone
from threading import Lock
import math
import logging
from uuid import uuid4

from fastapi import HTTPException
from app.core.config import settings


logger = logging.getLogger(__name__)


class InMemoryRateLimitStore:
    def __init__(self) -> None:
        self._buckets: dict[str, deque[datetime]] = defaultdict(deque)
        self._last_seen: dict[str, datetime] = {}
        self._lock = Lock()
        self._call_counter = 0
        self._cleanup_every = 100

    def clear(self) -> None:
        with self._lock:
            self._buckets.clear()
            self._last_seen.clear()

    def _cleanup_stale_keys(self, current: datetime, retention_seconds: int) -> None:
        if retention_seconds <= 0:
            return
        stale_cutoff = current - timedelta(seconds=retention_seconds)
        stale_keys = [k for k, ts in self._last_seen.items() if ts < stale_cutoff]
        for key in stale_keys:
            self._last_seen.pop(key, None)
            self._buckets.pop(key, None)

    def enforce(
        self,
        *,
        actor_id: int,
        scope: str,
        limit_per_minute: int,
        window_seconds: int = 60,
        retention_seconds: int = 300,
        now: datetime | None = None,
    ) -> dict[str, int]:
        if limit_per_minute <= 0:
            return {"limit": 0, "remaining": 0, "retry_after": 0}
        if window_seconds <= 0:
            window_seconds = 60

        current = now or datetime.now(timezone.utc)
        cutoff = current - timedelta(seconds=window_seconds)
        key = f"{scope}:{actor_id}"

        with self._lock:
            self._call_counter += 1
            if self._call_counter % self._cleanup_every == 0:
                self._cleanup_stale_keys(current, retention_seconds)

            bucket = self._buckets[key]
            while bucket and bucket[0] < cutoff:
                bucket.popleft()
            self._last_seen[key] = current

            if len(bucket) >= limit_per_minute:
                retry_after = 1
                if bucket:
                    retry_after = max(
                        1,
                        math.ceil((bucket[0] + timedelta(seconds=window_seconds) - current).total_seconds()),
                    )
                raise HTTPException(
                    status_code=429,
                    detail="יותר מדי בקשות בפרק זמן קצר. נסה שוב בעוד רגע.",
                    headers={
                        "Retry-After": str(retry_after),
                        "X-RateLimit-Limit": str(limit_per_minute),
                        "X-RateLimit-Remaining": "0",
                        "X-RateLimit-Window": str(window_seconds),
                    },
                )

            bucket.append(current)
            remaining = max(0, limit_per_minute - len(bucket))
            return {
                "limit": limit_per_minute,
                "remaining": remaining,
                "retry_after": 0,
            }


class RedisRateLimitStore:
    def __init__(self, redis_url: str, prefix: str = "rate_limit") -> None:
        import redis

        self._client = redis.Redis.from_url(redis_url, decode_responses=True)
        self._prefix = prefix
        self._fallback = InMemoryRateLimitStore()

    def _key(self, scope: str, actor_id: int) -> str:
        return f"{self._prefix}:{scope}:{actor_id}"

    def clear(self) -> None:
        try:
            cursor = 0
            pattern = f"{self._prefix}:*"
            while True:
                cursor, keys = self._client.scan(cursor=cursor, match=pattern, count=200)
                if keys:
                    self._client.delete(*keys)
                if cursor == 0:
                    break
        except Exception:
            self._fallback.clear()

    def enforce(
        self,
        *,
        actor_id: int,
        scope: str,
        limit_per_minute: int,
        window_seconds: int = 60,
        retention_seconds: int = 300,
        now: datetime | None = None,
    ) -> dict[str, int]:
        if limit_per_minute <= 0:
            return {"limit": 0, "remaining": 0, "retry_after": 0}
        if window_seconds <= 0:
            window_seconds = 60

        current_dt = now or datetime.now(timezone.utc)
        current_ts = current_dt.timestamp()
        window_start = current_ts - window_seconds
        key = self._key(scope, actor_id)

        try:
            pipe = self._client.pipeline()
            pipe.zremrangebyscore(key, "-inf", window_start)
            pipe.zcard(key)
            _, count = pipe.execute()

            if int(count) >= limit_per_minute:
                earliest = self._client.zrange(key, 0, 0, withscores=True)
                retry_after = 1
                if earliest:
                    retry_after = max(
                        1,
                        math.ceil((float(earliest[0][1]) + window_seconds) - current_ts),
                    )
                raise HTTPException(
                    status_code=429,
                    detail="יותר מדי בקשות בפרק זמן קצר. נסה שוב בעוד רגע.",
                    headers={
                        "Retry-After": str(retry_after),
                        "X-RateLimit-Limit": str(limit_per_minute),
                        "X-RateLimit-Remaining": "0",
                        "X-RateLimit-Window": str(window_seconds),
                    },
                )

            member = f"{current_ts}:{uuid4().hex}"
            ttl = max(1, retention_seconds, window_seconds * 2)
            pipe = self._client.pipeline()
            pipe.zadd(key, {member: current_ts})
            pipe.expire(key, ttl)
            pipe.zcard(key)
            _, _, new_count = pipe.execute()
            remaining = max(0, limit_per_minute - int(new_count))
            return {
                "limit": limit_per_minute,
                "remaining": remaining,
                "retry_after": 0,
            }
        except HTTPException:
            raise
        except Exception:
            # Fail-soft: if Redis is unavailable, degrade to in-process limiter
            # so API paths remain protected instead of failing hard.
            logger.exception("Redis rate limiter failed, falling back to in-memory limiter")
            return self._fallback.enforce(
                actor_id=actor_id,
                scope=scope,
                limit_per_minute=limit_per_minute,
                window_seconds=window_seconds,
                retention_seconds=retention_seconds,
                now=current_dt,
            )


_STORE: InMemoryRateLimitStore | RedisRateLimitStore | None = None
_STORE_BACKEND: str | None = None


def _get_store() -> InMemoryRateLimitStore | RedisRateLimitStore:
    global _STORE, _STORE_BACKEND
    backend = (settings.RATE_LIMIT_BACKEND or "memory").strip().lower()
    if backend not in {"memory", "redis"}:
        logger.warning("Unsupported RATE_LIMIT_BACKEND='%s', using in-memory backend", backend)
        backend = "memory"

    if _STORE is None or _STORE_BACKEND != backend:
        if backend == "redis":
            redis_url = (settings.RATE_LIMIT_REDIS_URL or "").strip()
            if not redis_url:
                logger.warning("RATE_LIMIT_BACKEND=redis but RATE_LIMIT_REDIS_URL is empty, using in-memory backend")
                _STORE = InMemoryRateLimitStore()
                backend = "memory"
            else:
                try:
                    _STORE = RedisRateLimitStore(
                        redis_url=redis_url,
                        prefix=settings.RATE_LIMIT_REDIS_KEY_PREFIX,
                    )
                except Exception:
                    logger.exception("Failed to initialize Redis rate limiter, using in-memory backend")
                    _STORE = InMemoryRateLimitStore()
                    backend = "memory"
        else:
            _STORE = InMemoryRateLimitStore()
        _STORE_BACKEND = backend

    return _STORE


def clear_rate_limits() -> None:
    """Testing helper to reset in-memory limiter state."""
    _get_store().clear()


def enforce_rate_limit(
    *,
    actor_id: int,
    scope: str,
    limit_per_minute: int,
    window_seconds: int = 60,
    retention_seconds: int = 300,
    now: datetime | None = None,
) -> dict[str, int]:
    return _get_store().enforce(
        actor_id=actor_id,
        scope=scope,
        limit_per_minute=limit_per_minute,
        window_seconds=window_seconds,
        retention_seconds=retention_seconds,
        now=now,
    )



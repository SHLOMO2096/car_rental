from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone
from threading import Lock

from fastapi import HTTPException


_BUCKETS: dict[str, deque[datetime]] = defaultdict(deque)
_LOCK = Lock()


def clear_rate_limits() -> None:
    """Testing helper to reset in-memory limiter state."""
    with _LOCK:
        _BUCKETS.clear()


def enforce_rate_limit(
    *,
    actor_id: int,
    scope: str,
    limit_per_minute: int,
    now: datetime | None = None,
) -> None:
    if limit_per_minute <= 0:
        return

    current = now or datetime.now(timezone.utc)
    cutoff = current - timedelta(minutes=1)
    key = f"{scope}:{actor_id}"

    with _LOCK:
        bucket = _BUCKETS[key]
        while bucket and bucket[0] < cutoff:
            bucket.popleft()

        if len(bucket) >= limit_per_minute:
            raise HTTPException(
                status_code=429,
                detail="יותר מדי בקשות בפרק זמן קצר. נסה שוב בעוד רגע.",
            )

        bucket.append(current)


"""
In-memory sliding-window rate limiting for the auth endpoints.

Per-process state, which matches the single-instance deployment. If the
backend ever runs multiple workers/instances, this needs a shared store
(e.g. Postgres or Redis) or each process enforces its own separate limit.
"""
import threading
import time
from collections import deque
from typing import Callable, Deque, Dict, Optional

from fastapi import HTTPException, Request, status


class SlidingWindowLimiter:
    MAX_KEYS = 10_000

    def __init__(self, max_events: int, window_seconds: float, clock: Callable[[], float] = time.monotonic):
        self.max_events = max_events
        self.window_seconds = window_seconds
        self._clock = clock
        self._events: Dict[str, Deque[float]] = {}
        self._lock = threading.Lock()

    def _prune(self, key: str, now: float) -> Optional[Deque[float]]:
        # Drops expired timestamps, and the key itself once empty, so keys
        # from one-off visitors don't accumulate forever.
        events = self._events.get(key)
        if events is None:
            return None
        while events and now - events[0] >= self.window_seconds:
            events.popleft()
        if not events:
            del self._events[key]
            return None
        return events

    def retry_after(self, key: str) -> Optional[int]:
        """Seconds until `key` may try again, or None if it's under the limit."""
        with self._lock:
            now = self._clock()
            events = self._prune(key, now)
            if events is None or len(events) < self.max_events:
                return None
            return max(1, int(self.window_seconds - (now - events[0])) + 1)

    def record(self, key: str) -> None:
        with self._lock:
            now = self._clock()
            # Keys that are never checked again (e.g. spoofed IPs) would
            # otherwise linger, so sweep everything once the table gets large.
            if len(self._events) >= self.MAX_KEYS:
                for stale_key in list(self._events):
                    self._prune(stale_key, now)
            events = self._prune(key, now)
            if events is None:
                events = self._events[key] = deque()
            events.append(now)

    def reset(self) -> None:
        with self._lock:
            self._events.clear()


def client_ip(request: Request) -> str:
    # Behind Render's proxy the socket peer is the proxy, so use the
    # X-Forwarded-For client entry. It's spoofable, which is why IP limits are
    # only a secondary layer: the per-username login limit doesn't use it.
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def enforce(limiter: SlidingWindowLimiter, key: str, detail: str) -> None:
    retry = limiter.retry_after(key)
    if retry is not None:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=detail,
            headers={"Retry-After": str(retry)},
        )


# Failed logins, counted per username (IP-independent, so rotating IPs
# doesn't help an attacker) and per client IP.
FAILED_LOGINS_PER_USERNAME = SlidingWindowLimiter(max_events=10, window_seconds=15 * 60)
FAILED_LOGINS_PER_IP = SlidingWindowLimiter(max_events=20, window_seconds=15 * 60)
# Every signup attempt hashes a password, so limit attempts, not just failures.
SIGNUPS_PER_IP = SlidingWindowLimiter(max_events=10, window_seconds=60 * 60)

ALL_LIMITERS = (FAILED_LOGINS_PER_USERNAME, FAILED_LOGINS_PER_IP, SIGNUPS_PER_IP)

from __future__ import annotations

import re
import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request

MAX_WINDOW_SECONDS = 60


class InMemoryRateLimiter:
    def __init__(self, requests_per_minute: int) -> None:
        self._rpm = max(1, requests_per_minute)
        self._buckets: dict[str, deque[float]] = defaultdict(deque)

    def check(self, key: str) -> None:
        now = time.time()
        bucket = self._buckets[key]
        while bucket and now - bucket[0] > MAX_WINDOW_SECONDS:
            bucket.popleft()
        if len(bucket) >= self._rpm:
            raise HTTPException(status_code=429, detail="Rate limit exceeded")
        bucket.append(now)


def sanitize_symptoms(text: str) -> str:
    cleaned = re.sub(r"\s+", " ", text.strip())
    cleaned = cleaned.replace("\x00", "")
    return cleaned[:4000]


def client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
    if forwarded:
        return forwarded
    if request.client and request.client.host:
        return request.client.host
    return "unknown"

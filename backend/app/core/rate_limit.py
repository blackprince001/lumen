"""Simple Redis-backed rate limiter for auth endpoints."""

import time

import redis.asyncio as aioredis
from fastapi import HTTPException, Request

from app.core.config import settings

_redis: aioredis.Redis | None = None


def _get_redis() -> aioredis.Redis:
  global _redis
  if _redis is None:
    _redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
  return _redis


async def rate_limit(request: Request, max_requests: int, window_seconds: int) -> None:
  """Raise 429 if the client IP has exceeded max_requests within window_seconds."""
  ip = request.client.host if request.client else "unknown"
  path = request.url.path.replace("/", "_")
  key = f"rl:{path}:{ip}"

  try:
    r = _get_redis()
    now = int(time.time())
    window_start = now - window_seconds

    pipe = r.pipeline()
    pipe.zremrangebyscore(key, 0, window_start)
    pipe.zadd(key, {str(now * 1000 + id(request)): now})
    pipe.zcard(key)
    pipe.expire(key, window_seconds)
    results = await pipe.execute()

    count = results[2]
    if count > max_requests:
      raise HTTPException(
        status_code=429,
        detail="Too many requests. Please try again later.",
        headers={"Retry-After": str(window_seconds)},
      )
  except HTTPException:
    raise
  except Exception:
    # If Redis is unavailable, fail open (don't block legitimate requests)
    pass

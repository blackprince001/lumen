"""Base task classes for Celery workers.

Tasks resolve the AI provider per paper owner (``get_provider_for_user_sync``)
— there is no environment-default provider.
"""

from contextlib import contextmanager
from typing import TYPE_CHECKING, Generator

from celery import Task
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import SyncSessionLocal
from app.core.logger import get_logger
from app.services.ai.helpers import ProviderLookupError

if TYPE_CHECKING:
  import redis as _redis

logger = get_logger(__name__)


def get_redis() -> "_redis.Redis":
  """Return a Redis client (decoded responses) for task-side coordination."""
  import redis

  return redis.Redis(
    host=settings.REDIS_HOST,
    port=settings.REDIS_PORT,
    db=settings.REDIS_DB,
    password=settings.REDIS_PASSWORD or None,
    decode_responses=True,
  )


class PermanentTaskError(Exception):
  """Exception that should NOT be retried (e.g., invalid input, not found)."""

  pass


class BaseTask(Task):
  """Base task with common configuration."""

  abstract = True
  autoretry_for = (ConnectionError, TimeoutError, OSError)
  dont_autoretry_for = (PermanentTaskError, ValueError, KeyError)
  retry_backoff = True
  retry_backoff_max = 600
  max_retries = 3
  retry_jitter = True
  soft_time_limit = 300
  time_limit = 360

  def on_failure(self, exc, task_id, args, kwargs, einfo):
    logger.error(
      "Task failed",
      task_name=self.name,
      task_id=task_id,
      args=args,
      error=str(exc),
    )

  def on_retry(self, exc, task_id, args, kwargs, einfo):
    logger.warning(
      "Task retrying",
      task_name=self.name,
      task_id=task_id,
      args=args,
      error=str(exc),
      retry_count=self.request.retries,
    )

  def on_success(self, retval, task_id, args, kwargs):
    logger.info(
      "Task completed",
      task_name=self.name,
      task_id=task_id,
    )


class BaseAITask(BaseTask):
  """Base task for AI operations with rate limiting and retry support.

  Tasks resolve the provider per paper owner via
  ``get_provider_for_user_sync``; there is no environment-default provider.
  A failed provider lookup (``ProviderLookupError``) is retried rather than
  reported as "no provider", which previously caused spurious skips under
  load (e.g., the parallel processing chord on bulk ingestion).
  """

  abstract = True
  autoretry_for = (ConnectionError, TimeoutError, OSError, ProviderLookupError)
  retry_backoff = True
  retry_backoff_max = 600
  max_retries = 5
  rate_limit = "10/m"
  soft_time_limit = 240
  time_limit = 300


def get_sync_session() -> Session:
  """Get a synchronous database session for Celery tasks."""
  return SyncSessionLocal()


@contextmanager
def sync_session_scope() -> Generator[Session, None, None]:
  """Provide a transactional scope around a series of operations."""
  session = SyncSessionLocal()
  try:
    yield session
    session.commit()
  except Exception:
    session.rollback()
    raise
  finally:
    session.close()

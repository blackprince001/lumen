"""Base task classes for Celery workers.

Provider-agnostic design — tasks resolve the appropriate AI provider
from environment defaults rather than being hardcoded to Gemini.
"""

from contextlib import contextmanager
from typing import Generator

from celery import Task
from sqlalchemy.orm import Session

from app.core.database import SyncSessionLocal
from app.core.logger import get_logger
from app.services.ai.provider_factory import create_default_provider
from app.services.ai.providers.base import AIProvider

logger = get_logger(__name__)


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

  Tasks resolve the AI provider from environment defaults (backward
  compatible with GOOGLE_API_KEY) or from a configured provider.
  """

  abstract = True
  autoretry_for = (ConnectionError, TimeoutError, OSError)
  retry_backoff = True
  retry_backoff_max = 600
  max_retries = 5
  rate_limit = "10/m"
  soft_time_limit = 240
  time_limit = 300

  def __init__(self) -> None:
    super().__init__()
    self._provider_instance: AIProvider | None = None

  @property
  def provider(self) -> AIProvider | None:
    """Get or create an AI provider instance for this task.

    Uses the default provider resolution (from env settings).
    """
    if self._provider_instance is not None:
      return self._provider_instance

    # For Celery tasks (sync context), create default provider directly
    # without the async DB lookup
    self._provider_instance = create_default_provider()
    if not self._provider_instance:
      logger.warning("No AI provider available for Celery task")
    return self._provider_instance

  @provider.setter
  def provider(self, value: AIProvider | None) -> None:
    self._provider_instance = value

  @property
  def client(self) -> None:
    """Deprecated. Use ``provider`` instead.

    This property exists only to catch old code still calling ``.client``
    on tasks.  It will raise a clear error directing to the new API.
    """
    raise AttributeError(
      "BaseAITask.client is deprecated. Use BaseAITask.provider instead. "
      "Call provider.generate() or provider.embed() directly."
    )


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

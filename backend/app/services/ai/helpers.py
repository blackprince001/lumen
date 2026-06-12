"""Helper functions for getting AI providers within services."""

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logger import get_logger
from app.crud.user_ai_settings import get_user_ai_settings
from app.services.ai.provider_factory import (
  create_default_provider,
  create_provider_from_settings,
)
from app.services.ai.providers.base import AIProvider

logger = get_logger(__name__)


async def get_provider_for_user(
  db_session: AsyncSession | None = None,
  user_id: int | None = None,
) -> AIProvider | None:
  """Get the AI provider configured for a user, falling back to defaults.

  Resolution order:
  1. User-specific AI settings from database
  2. Default provider from environment (GOOGLE_API_KEY, etc.)
  3. None (no provider available)

  Args:
      db_session: Database session (required if user_id is given)
      user_id: User ID to look up settings for

  Returns:
      Configured AI provider or None
  """
  if user_id is not None and db_session is not None:
    try:
      ai_settings = await get_user_ai_settings(db_session, user_id)
      if ai_settings and ai_settings.is_configured:
        provider = create_provider_from_settings(ai_settings)
        if provider:
          return provider
        logger.warning(
          "Failed to create provider from user settings",
          user_id=user_id,
          provider=ai_settings.provider,
        )
    except Exception as e:
      logger.error(
        "Error loading user AI settings",
        user_id=user_id,
        error=str(e),
      )

  default = create_default_provider()
  if default:
    return default

  logger.warning("No AI provider available")
  return None

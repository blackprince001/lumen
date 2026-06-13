"""Helper functions for getting AI providers within services."""

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logger import get_logger
from app.crud.user_ai_settings import get_user_ai_settings
from app.services.ai.provider_factory import (
  create_default_provider,
  create_provider_from_config,
  create_provider_from_settings,
)
from app.services.ai.providers.base import AIProvider

logger = get_logger(__name__)


async def get_provider_for_user(
  db_session: AsyncSession | None = None,
  user_id: int | None = None,
  preferred_provider_id: int | None = None,
) -> AIProvider | None:
  """Get the AI provider configured for a user, falling back to defaults.

  Resolution order:
  1. The user's saved ``user_ai_providers`` (preferred id, else default)
  2. Legacy single ``user_ai_settings`` row (back-compat)
  3. Default provider from environment (GOOGLE_API_KEY, etc.)
  4. None (no provider available)

  Args:
      db_session: Database session (required if user_id is given)
      user_id: User ID to look up settings for
      preferred_provider_id: A specific saved provider to prefer

  Returns:
      Configured AI provider or None
  """
  if user_id is not None and db_session is not None:
    provider = await _provider_from_saved(
      db_session, user_id, preferred_provider_id
    )
    if provider:
      return provider

    # Back-compat: legacy single-row settings.
    try:
      ai_settings = await get_user_ai_settings(db_session, user_id)
      if ai_settings and ai_settings.is_configured:
        legacy = create_provider_from_settings(ai_settings)
        if legacy:
          return legacy
    except Exception as e:
      logger.error("Error loading user AI settings", user_id=user_id, error=str(e))

  default = create_default_provider()
  if default:
    return default

  logger.warning("No AI provider available")
  return None


async def _provider_from_saved(
  db_session: AsyncSession,
  user_id: int,
  preferred_provider_id: int | None,
) -> AIProvider | None:
  """Build an AIProvider from the user's saved ``user_ai_providers``."""
  try:
    from app.crud.user_ai_provider import (
      get_default_provider,
      get_user_ai_provider,
    )

    row = None
    if preferred_provider_id is not None:
      row = await get_user_ai_provider(db_session, user_id, preferred_provider_id)
      if row is not None and not (row.is_active and row.is_configured):
        row = None
    if row is None:
      row = await get_default_provider(db_session, user_id)
    if row is None or not row.is_configured:
      return None

    return create_provider_from_config(
      provider_type=row.provider or "openai-compatible",
      api_key=row.get_api_key(),
      base_url=row.base_url,
      model=row.model,
      embedding_model=row.embedding_model,
      embedding_dimension=row.embedding_dimension or 768,
    )
  except Exception as e:
    logger.error("Error loading user AI providers", user_id=user_id, error=str(e))
    return None

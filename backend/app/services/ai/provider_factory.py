from app.core.logger import get_logger
from app.models.user_ai_settings import UserAISettings
from app.services.ai.providers.base import AIProvider, ProviderConfig
from app.services.ai.providers.registry import ai_provider_registry

logger = get_logger(__name__)


def create_provider_from_settings(
  ai_settings: UserAISettings,
) -> AIProvider | None:
  """Create an AI provider instance from user AI settings.

  Args:
      ai_settings: User's AI provider settings from the database

  Returns:
      Configured AI provider, or None if the provider type is unknown
  """
  config = ProviderConfig(
    provider=ai_settings.provider or "openai-compatible",
    api_key=ai_settings.get_api_key(),
    base_url=ai_settings.base_url,
    model=ai_settings.model,
  )

  provider = ai_provider_registry.create(config.provider, config)
  if provider is None:
    logger.error(
      "Could not create provider from settings",
      provider_type=config.provider,
    )
  return provider


def create_provider_from_config(
  provider_type: str,
  api_key: str,
  base_url: str | None = None,
  model: str | None = None,
) -> AIProvider | None:
  """Create an AI provider instance from explicit configuration values.

  Useful for Celery tasks and system-level operations where there
  is no user-specific settings context. Embeddings are not configured here
  — they always run through the Google embedding service.
  """
  config = ProviderConfig(
    provider=provider_type,
    api_key=api_key,
    base_url=base_url,
    model=model or "",
  )
  return ai_provider_registry.create(provider_type, config)

from app.core.config import settings
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
    embedding_model=ai_settings.embedding_model,
    embedding_dimension=ai_settings.embedding_dimension or 768,
  )

  provider = ai_provider_registry.create(config.provider, config)
  if provider is None:
    logger.error(
      "Could not create provider from settings",
      provider_type=config.provider,
    )
  return provider


def create_default_provider() -> AIProvider | None:
  """Create a default AI provider from environment settings.

  This provides backward compatibility when no user-specific
  settings are configured.  Resolution order:

  1. ``OPENAI_API_KEY`` → OpenAI provider
  2. ``ANTHROPIC_API_KEY`` → Anthropic provider
  3. ``DEEPSEEK_API_KEY`` → DeepSeek provider
  4. ``GOOGLE_API_KEY`` → Gemini provider (legacy)
  """
  env_providers = [
    ("openai", settings.OPENAI_API_KEY, "gpt-4o"),
    ("anthropic", settings.ANTHROPIC_API_KEY, "claude-sonnet-4-20250514"),
    ("deepseek", settings.DEEPSEEK_API_KEY, "deepseek-chat"),
  ]

  for provider_type, api_key, default_model in env_providers:
    if api_key:
      config = ProviderConfig(
        provider=provider_type,
        api_key=api_key,
        model=default_model,
        embedding_model=settings.EMBEDDING_MODEL,
        embedding_dimension=settings.EMBEDDING_DIMENSION,
      )
      provider = ai_provider_registry.create(provider_type, config)
      if provider:
        return provider

  if settings.GOOGLE_API_KEY:
    config = ProviderConfig(
      provider="gemini",
      api_key=settings.GOOGLE_API_KEY,
      model=settings.GENAI_MODEL,
      embedding_model=settings.EMBEDDING_MODEL,
      embedding_dimension=settings.EMBEDDING_DIMENSION,
    )
    provider = ai_provider_registry.create("gemini", config)
    if provider:
      return provider

  return None


def create_provider_from_config(
  provider_type: str,
  api_key: str,
  base_url: str | None = None,
  model: str | None = None,
  embedding_model: str | None = None,
  embedding_dimension: int | None = None,
) -> AIProvider | None:
  """Create an AI provider instance from explicit configuration values.

  Useful for Celery tasks and system-level operations where there
  is no user-specific settings context.
  """
  config = ProviderConfig(
    provider=provider_type,
    api_key=api_key,
    base_url=base_url,
    model=model or "",
    embedding_model=embedding_model or "",
    embedding_dimension=embedding_dimension or 768,
  )
  return ai_provider_registry.create(provider_type, config)

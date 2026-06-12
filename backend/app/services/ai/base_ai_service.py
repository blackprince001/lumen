"""Provider-agnostic base class for AI services.

Replaces the previous BaseGoogleAIService that was hardcoded to Gemini.
Services now resolve the user's configured provider and use it transparently.
"""

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logger import get_logger
from app.services.ai.helpers import get_provider_for_user
from app.services.ai.providers.base import (
  AIProvider,
  GenerateConfig,
)

logger = get_logger(__name__)


class BaseAIService:
  """Base service for AI operations.

  Provides provider resolution from user settings with fallback
  to environment defaults.  Services that extend this class can
  call ``self._get_provider(db_session, user_id)`` to obtain the
  appropriate provider instance for the current request context.
  """

  def __init__(self) -> None:
    self._provider: AIProvider | None = None

  async def _get_provider(
    self,
    db_session: AsyncSession | None = None,
    user_id: int | None = None,
  ) -> AIProvider | None:
    """Resolve the AI provider for the given user context.

    Once a provider is resolved it is cached on the instance for
    the duration of the request.  Callers may pass ``None`` for
    both arguments to use the environment-default provider.

    Returns:
        An AIProvider instance, or None if no provider is available.
    """
    if self._provider is not None:
      return self._provider

    self._provider = await get_provider_for_user(db_session, user_id)
    return self._provider

  def set_provider(self, provider: AIProvider) -> None:
    """Explicitly override the provider (e.g. for testing)."""
    self._provider = provider

  def _build_config(
    self,
    provider: AIProvider,
    system_instruction: str | None = None,
    temperature: float = 0.7,
    max_output_tokens: int | None = None,
  ) -> GenerateConfig:
    """Build a GenerateConfig from the resolved provider + overrides."""
    return GenerateConfig(
      model=provider.config.model or "",
      system_instruction=system_instruction,
      temperature=temperature,
      max_output_tokens=max_output_tokens,
    )

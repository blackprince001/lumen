from typing import Any

from app.core.logger import get_logger
from app.services.ai.providers.base import AIProvider, ProviderConfig
from app.services.ai.providers.gemini import GeminiProvider
from app.services.ai.providers.openai_compatible import (
  AnthropicProvider,
  DeepSeekProvider,
  OpenAICompatibleProvider,
  OpenAIProvider,
)

logger = get_logger(__name__)


class AIProviderRegistry:
  """Registry of available AI provider types.

  Maps provider type strings to their implementation classes.
  """

  def __init__(self) -> None:
    self._providers: dict[str, type[AIProvider]] = {}

  def register(self, name: str, provider_class: type[AIProvider]) -> None:
    """Register a provider type.

    Args:
        name: Provider type name (e.g. 'gemini', 'openai-compatible')
        provider_class: Provider implementation class
    """
    self._providers[name] = provider_class
    logger.info("Registered AI provider", provider=name)

  def get_class(self, name: str) -> type[AIProvider] | None:
    """Get the provider class for a given type name."""
    return self._providers.get(name)

  def create(self, provider_type: str, config: ProviderConfig) -> AIProvider | None:
    """Create a provider instance for the given type.

    Args:
        provider_type: Provider type name
        config: Provider configuration

    Returns:
        Provider instance or None if type not found
    """
    provider_class = self._providers.get(provider_type)
    if not provider_class:
      logger.error("Unknown AI provider type", provider=provider_type)
      return None
    return provider_class(config)

  def list_types(self) -> list[dict[str, Any]]:
    """List all registered provider types with metadata."""
    result = []
    for name, cls in self._providers.items():
      temp_instance: AIProvider | None = None
      try:
        temp_instance = cls(ProviderConfig())
      except Exception:
        pass
      result.append(
        {
          "type": name,
          "display_name": getattr(cls, "display_name", name),
          "supports_grounding": (
            temp_instance.supports_grounding if temp_instance else False
          ),
        }
      )
    return result


# Global registry singleton
ai_provider_registry = AIProviderRegistry()
ai_provider_registry.register("gemini", GeminiProvider)
ai_provider_registry.register("openai-compatible", OpenAICompatibleProvider)
ai_provider_registry.register("openai", OpenAIProvider)
ai_provider_registry.register("deepseek", DeepSeekProvider)
ai_provider_registry.register("anthropic", AnthropicProvider)

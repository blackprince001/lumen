"""Build ``RunConfig`` instances for agent execution.

Encapsulates the logic for selecting the right model and provider
configuration based on the user's settings and the current request.
"""

from __future__ import annotations

from app.core.logger import get_logger
from app.services.ai.agent.multi_provider import (
  MultiProviderBuilder,
  ProviderRouteConfig,
)

logger = get_logger(__name__)

# OpenAI Agents SDK — optional dependency
try:
  from agents import ModelSettings, RunConfig
  from agents.models.openai_provider import OpenAIProvider
  from openai import AsyncOpenAI

  _HAS_AGENTS_SDK = True
except ImportError:
  ModelSettings = object  # type: ignore[misc,assignment]
  RunConfig = object  # type: ignore[misc,assignment]
  OpenAIProvider = object  # type: ignore[misc,assignment]
  AsyncOpenAI = object  # type: ignore[misc,assignment]
  _HAS_AGENTS_SDK = False


def build_run_config(
  provider_configs: list[ProviderRouteConfig],
  model_hint: str | None = None,
  temperature: float = 0.7,
  max_tokens: int | None = None,
  include_usage: bool = True,
) -> RunConfig:
  """Build a ``RunConfig`` for the selected model and provider.

  Resolution order for *model_hint*:

  1. A fully-qualified model string (e.g. ``openai/gpt-4o``) is used
     as-is and routed by the ``MultiProvider`` prefix system.
  2. A short model name (e.g. ``gpt-4o``) is matched against the first
     provider that lists it as its ``default_model``.
  3. If no hint is given, the first active provider's default model is
     used.

  Args:
      provider_configs: List of user-configured provider routes.
      model_hint: Optional model string (prefixed or short name).
      temperature: Generation temperature.
      max_tokens: Max output tokens.
      include_usage: Attach usage metadata to the result.

  Returns:
      A configured ``RunConfig``.
  """
  from app.services.ai.agent.sdk_patches import apply_sdk_patches

  apply_sdk_patches()

  builder = MultiProviderBuilder()
  for cfg in provider_configs:
    if cfg.is_active:
      builder.add_provider(cfg)

  if not builder.provider_list:
    raise ValueError(
      "No active AI providers configured. Please add a provider in your settings."
    )

  model, provider_prefix = _resolve_model(builder, model_hint)

  run_config = RunConfig(
    model=model,
    model_provider=builder.build(),
    model_settings=ModelSettings(
      temperature=temperature,
      max_tokens=max_tokens,
      parallel_tool_calls=False,
    ),
  )

  logger.debug(
    "Built RunConfig",
    model=model,
    provider_prefix=provider_prefix,
    temperature=temperature,
  )

  return run_config


def build_run_config_for_local(
  model_name: str,
  base_url: str,
  api_key: str = "local",
  temperature: float = 0.7,
  max_tokens: int | None = None,
) -> RunConfig:
  """Build a ``RunConfig`` for a local / self-hosted model.

  Useful for one-off queries against Ollama, vLLM, or LM Studio
  without going through the full provider resolution flow.

  Args:
      model_name: Model name as the endpoint expects it (e.g. ``llama3``).
      base_url: Base URL of the local endpoint.
      api_key: API key (often ignored by local servers).
      temperature: Generation temperature.
      max_tokens: Max output tokens.

  Returns:
      A configured ``RunConfig``.
  """
  client = AsyncOpenAI(api_key=api_key, base_url=base_url)

  return RunConfig(
    model=model_name,
    model_provider=OpenAIProvider(openai_client=client),
    model_settings=ModelSettings(
      temperature=temperature,
      max_tokens=max_tokens,
    ),
  )


def build_simple_run_config(
  api_key: str,
  model: str = "gpt-4o",
  base_url: str | None = None,
) -> RunConfig:
  """Build a ``RunConfig`` for a single OpenAI-compatible provider.

  Args:
      api_key: API key for the provider.
      model: Model name to use.
      base_url: Optional base URL override.  Defaults to OpenAI.

  Returns:
      A configured ``RunConfig``.
  """
  client = AsyncOpenAI(
    api_key=api_key,
    base_url=base_url or "https://api.openai.com/v1",
  )

  return RunConfig(
    model=model,
    model_provider=OpenAIProvider(openai_client=client),
  )


def _resolve_model(
  builder: MultiProviderBuilder,
  model_hint: str | None,
) -> tuple[str, str | None]:
  """Resolve *model_hint* to a fully-qualified model string and prefix.

  Returns ``(model_string, provider_prefix)``.
  """
  if not model_hint:
    return _first_default(builder)

  prefix = builder.get_prefix_for_model(model_hint)
  if prefix:
    return model_hint, prefix

  providers = builder.provider_list
  match = next(
    (p for p in providers if p.default_model == model_hint),
    providers[0] if providers else None,
  )
  if match is not None:
    return f"{match.model_prefix}{model_hint}", match.model_prefix

  return model_hint, None


def _first_default(builder: MultiProviderBuilder) -> tuple[str, str | None]:
  """Return the first active provider's default model."""
  for provider in builder.provider_list:
    if provider.default_model:
      return f"{provider.model_prefix}{provider.default_model}", provider.model_prefix

  return "", None

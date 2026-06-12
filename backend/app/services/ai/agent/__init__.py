"""Agent orchestration layer.

Provides multi-provider routing, agent definitions, function tools,
and streaming adapters.  The ``openai-agents`` SDK is optional — when
it is not installed, SDK-dependent functionality raises at call time
and the legacy provider path remains available.
"""

from app.services.ai.agent.context import (
  BYOContext,
  get_byo_context,
  reset_byo_context,
  set_byo_context,
)
from app.services.ai.agent.multi_provider import ProviderRouteConfig
from app.services.ai.agent.stream_adapter import (
  ERROR_CODE_AUTH,
  ERROR_CODE_INTERNAL,
  ERROR_CODE_NETWORK,
  ERROR_CODE_NO_PROVIDER,
  ERROR_CODE_PROVIDER_UNAVAILABLE,
  ERROR_CODE_RATE_LIMIT,
  ERROR_CODE_TIMEOUT,
  ERROR_CODE_TOOL_ERROR,
)

# SDK-dependent exports — imported lazily so the package loads without openai-agents
try:
  from app.services.ai.agent.multi_provider import (
    BuiltProvider,
    MultiProviderBuilder,
    build_from_configs,
  )
except ImportError:
  BuiltProvider = None  # type: ignore[assignment]
  MultiProviderBuilder = None  # type: ignore[assignment]
  build_from_configs = None  # type: ignore[assignment]

try:
  from app.services.ai.agent.run_config import (
    build_run_config,
    build_run_config_for_local,
    build_simple_run_config,
  )
except ImportError:
  build_run_config = None  # type: ignore[assignment]
  build_run_config_for_local = None  # type: ignore[assignment]
  build_simple_run_config = None  # type: ignore[assignment]

try:
  from app.services.ai.agent.stream_adapter import adapt_stream
except ImportError:
  adapt_stream = None  # type: ignore[assignment]

__all__ = [
  "BuiltProvider",
  "BYOContext",
  "MultiProviderBuilder",
  "ProviderRouteConfig",

  # Structured error codes
  "ERROR_CODE_AUTH",
  "ERROR_CODE_INTERNAL",
  "ERROR_CODE_NETWORK",
  "ERROR_CODE_NO_PROVIDER",
  "ERROR_CODE_PROVIDER_UNAVAILABLE",
  "ERROR_CODE_RATE_LIMIT",
  "ERROR_CODE_TIMEOUT",
  "ERROR_CODE_TOOL_ERROR",

  "adapt_stream",
  "build_from_configs",
  "build_run_config",
  "build_run_config_for_local",
  "build_simple_run_config",

  "get_byo_context",
  "reset_byo_context",
  "set_byo_context",
]

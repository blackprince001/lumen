"""Shared error classification and user-facing message building.

Extracted from ``chat.py`` so the same logic can be used by the stream
adapter, fallback runner, and API routes — not just the legacy provider
path.
"""

import re

from app.services.ai.providers.base import AIProviderError, AuthError, RateLimitError

# A 5xx HTTP status as a standalone token (avoids matching "gpt-5", "415",
# timestamps, or any string that merely contains the digit 5).
_SERVER_ERROR_RE = re.compile(r"\b5\d\d\b")

# Structured error codes  (mirrored from stream_adapter for import convenience)
ERROR_CODE_RATE_LIMIT = "rate_limit"
ERROR_CODE_AUTH = "auth"
ERROR_CODE_PROVIDER_UNAVAILABLE = "provider_unavailable"
ERROR_CODE_TIMEOUT = "timeout"
ERROR_CODE_TOOL_ERROR = "tool_error"
ERROR_CODE_INTERNAL = "internal"
ERROR_CODE_MAX_TURNS = "max_turns"
ERROR_CODE_NETWORK = "network"
ERROR_CODE_NO_PROVIDER = "no_provider"

RATE_LIMIT_ERROR_MESSAGE = (
  "I apologize, but I've hit the API rate limit. Please wait a moment and try again."
)

API_KEY_ERROR_MESSAGE = (
  "I apologize, but there's an issue with the API key configuration. "
  "Please check your AI provider settings and ensure the key is valid."
)

# Reaching the provider but being denied for quota/permission reasons usually
# means the key itself is too limited rather than invalid — most commonly a
# Gemini free-tier key, whose quotas are very low. Point the user at a
# billing-enabled key instead of telling them to "just wait".
QUOTA_REACH_ERROR_MESSAGE = (
  "I reached the AI provider, but this API key doesn't have enough quota/reach "
  "for the request. If this is a Gemini free-tier key, its limits are very low — "
  "switch to an API key with billing enabled (or a higher tier) for reliable access."
)


def _looks_like_quota_reach_issue(error: Exception) -> bool:
  """Heuristic: the provider was reachable but rejected the key for quota or
  access-tier reasons (free-tier exhaustion, per-day limits, missing billing)."""
  text = (str(error) + " " + type(error).__name__).lower()
  signals = (
    "resource_exhausted",
    "free tier",
    "free_tier",
    "freetier",
    "quota",
    "perdayperproject",
    "requests per day",
    "billing",
    "exceeded your current quota",
    "insufficient_quota",
  )
  return any(s in text for s in signals)


def classify_exception(error: Exception) -> tuple[str, bool]:
  """Classify an exception into ``(error_code, recoverable)``."""
  if isinstance(error, RateLimitError):
    return ERROR_CODE_RATE_LIMIT, True
  if isinstance(error, AuthError):
    return ERROR_CODE_AUTH, False

  error_str = str(error).lower()
  error_name = type(error).__name__.lower()

  if any(k in error_str + error_name for k in ("429", "rate", "ratelimit")):
    return ERROR_CODE_RATE_LIMIT, True
  if any(
    k in error_str + error_name
    for k in ("auth", "api key", "unauthorized", "401", "403")
  ):
    return ERROR_CODE_AUTH, False
  if any(k in error_str + error_name for k in ("timeout", "timed out")):
    return ERROR_CODE_TIMEOUT, True
  if "unavailable" in error_str + error_name or _SERVER_ERROR_RE.search(error_str):
    return ERROR_CODE_PROVIDER_UNAVAILABLE, True
  if any(k in error_str for k in ("connect", "network", "econnrefused", "econnreset")):
    return ERROR_CODE_NETWORK, True

  return ERROR_CODE_INTERNAL, False


def build_error_message(error: Exception) -> str:
  """Build a user-facing error message from a provider-agnostic error."""
  if isinstance(error, RateLimitError):
    # A rate limit that's really free-tier/quota exhaustion needs different
    # advice than a transient burst limit.
    if _looks_like_quota_reach_issue(error):
      return QUOTA_REACH_ERROR_MESSAGE
    return RATE_LIMIT_ERROR_MESSAGE
  if isinstance(error, AuthError):
    # A reachable key denied for quota/permission reasons isn't "invalid" —
    # steer toward a higher-tier / billing-enabled key.
    if _looks_like_quota_reach_issue(error):
      return QUOTA_REACH_ERROR_MESSAGE
    return API_KEY_ERROR_MESSAGE
  if isinstance(error, AIProviderError):
    return f"I apologize, but I encountered an error: {str(error)[:200]}"
  return f"I apologize, but I encountered an error: {str(error)[:200]}"

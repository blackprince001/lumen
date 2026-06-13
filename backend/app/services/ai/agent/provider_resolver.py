"""Resolve a user's AI providers into an ordered fallback chain.

Reads the ``user_ai_providers`` table and returns an ordered list of
:class:`ResolvedProvider` — the head is the provider a request/session
prefers, followed by the user's default and any other active providers.
The chat services try them in order, advancing on error.

Falls back to environment-configured providers when the user has none.
"""

from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logger import get_logger
from app.services.ai.agent.multi_provider import ProviderRouteConfig

logger = get_logger(__name__)


@dataclass
class ResolvedProvider:
  """A single provider in the resolved fallback chain.

  ``provider_id`` is ``None`` for environment-derived fallbacks (which
  cannot be persisted on a session).
  """

  provider_id: int | None
  label: str
  route: ProviderRouteConfig


async def resolve_providers(
  db_session: AsyncSession,
  user_id: int | None,
  preferred_provider_id: int | None = None,
) -> list[ResolvedProvider]:
  """Return the ordered provider fallback chain for a user.

  Order: ``preferred_provider_id`` (if active) → default → other active
  providers (newest first).  If the user has no usable providers, falls
  back to environment-configured keys.
  """
  resolved: list[ResolvedProvider] = []

  if user_id is not None:
    try:
      from app.crud.user_ai_provider import list_user_ai_providers

      rows = await list_user_ai_providers(db_session, user_id)
      active = [r for r in rows if r.is_active and r.is_configured]

      def _sort_key(r) -> tuple[int, int]:
        # preferred first (0), then default (1), then the rest (2)
        if preferred_provider_id is not None and r.id == preferred_provider_id:
          rank = 0
        elif r.is_default:
          rank = 1
        else:
          rank = 2
        return (rank, -r.id)

      for r in sorted(active, key=_sort_key):
        resolved.append(
          ResolvedProvider(
            provider_id=r.id,
            label=r.label or r.provider,
            route=ProviderRouteConfig(
              provider_type=r.provider or "openai-compatible",
              api_key=r.get_api_key(),
              base_url=r.base_url,
              default_model=r.model,
            ),
          )
        )
    except Exception as e:
      logger.error("Error loading user AI providers", user_id=user_id, error=str(e))

  if not resolved:
    resolved = _env_fallback_providers()

  return resolved


def _env_fallback_providers() -> list[ResolvedProvider]:
  """Build providers from environment-configured API keys."""
  from app.core.config import settings as app_settings

  candidates: list[tuple[str, str | None, str]] = [
    ("gemini", app_settings.GOOGLE_API_KEY, app_settings.GENAI_MODEL),
    ("openai", app_settings.OPENAI_API_KEY, "gpt-4o"),
    ("anthropic", app_settings.ANTHROPIC_API_KEY, "claude-sonnet-4-20250514"),
    ("deepseek", app_settings.DEEPSEEK_API_KEY, "deepseek-chat"),
  ]

  fallbacks: list[ResolvedProvider] = []
  for provider_type, api_key, default_model in candidates:
    if not api_key:
      continue
    fallbacks.append(
      ResolvedProvider(
        provider_id=None,
        label=f"{provider_type} (server)",
        route=ProviderRouteConfig(
          provider_type=provider_type,
          api_key=api_key,
          default_model=default_model,
        ),
      )
    )
  return fallbacks

"""Per-request context for BYO key agent operations.

Holds the user's identity and credentials for the duration of a request,
making them available to agent tools without threading them through every
function signature.
"""

from contextvars import ContextVar
from dataclasses import dataclass, field
from typing import Any

from app.services.ai.agent.multi_provider import ProviderRouteConfig


@dataclass
class BYOContext:
  """Request-scoped context for agent execution.

  Set once per incoming request (e.g. inside a FastAPI dependency or
  middleware) and read by ``@function_tool`` implementations that need
  the current user's identity, database session, or provider configs.
  """

  user_id: int | None = None

  provider_configs: list[ProviderRouteConfig] = field(default_factory=list)

  extra: dict[str, Any] = field(default_factory=dict)


_byo_context: ContextVar[BYOContext] = ContextVar("byo_context", default=BYOContext())  # noqa: B039


def get_byo_context() -> BYOContext:
  """Return the current request's BYO context."""
  return _byo_context.get()


def set_byo_context(ctx: BYOContext) -> None:
  """Set the BYO context for the current request."""
  _byo_context.set(ctx)


def reset_byo_context() -> None:
  """Reset the BYO context to default (call at end of request)."""
  _byo_context.set(BYOContext())


class BYOContextDependency:
  """FastAPI dependency that builds and sets the BYO context.

  Usage in a route::

      @router.post("/chat")
      async def chat(byo: BYOContextDependency = Depends()):
          ctx = byo.get_context()
          ...

  Or use the middleware directly::

      @app.middleware("http")
      async def byo_middleware(request, call_next):
          ctx = build_context_from_request(request)
          set_byo_context(ctx)
          try:
              return await call_next(request)
          finally:
              reset_byo_context()
  """

  def get_context(self) -> BYOContext:
    return get_byo_context()

"""Run an agent across a provider fallback chain.

Tries each :class:`ResolvedProvider` in order.  If a provider errors
*before* emitting any content, and another provider remains, it emits a
``provider_switched`` event and retries with the next one.  Once content
has started streaming, errors are surfaced as-is (no mid-response retry,
to avoid duplicated output).
"""

from __future__ import annotations

from typing import Any, AsyncGenerator

from app.core.logger import get_logger
from app.services.ai.agent import adapt_stream, build_run_config
from app.services.ai.agent.provider_resolver import ResolvedProvider

logger = get_logger(__name__)


async def stream_agent_with_fallback(
  runner: Any,
  agent: Any,
  user_message: str,
  providers: list[ResolvedProvider],
  session_id: int | None,
  used_holder: list[ResolvedProvider],
) -> AsyncGenerator[dict[str, Any], None]:
  """Stream an agent run, falling back across ``providers`` on early errors.

  Args:
      runner: The SDK ``Runner`` class.
      agent: The agent to run.
      user_message: The user's input.
      providers: Ordered fallback chain (head tried first).
      session_id: For the adapter's ``done`` event.
      used_holder: Mutated to append the provider that ultimately produced
          the response (so the caller can persist it on the session).

  Yields:
      Adapted SSE chunk dicts, plus ``provider_switched`` events.
  """
  last_error: dict[str, Any] | None = None

  for idx, rp in enumerate(providers):
    has_more = idx < len(providers) - 1
    emitted_content = False
    hit_error = False

    try:
      run_config = build_run_config(
        provider_configs=[rp.route],
        model_hint=rp.route.default_model or None,
      )
      result = runner.run_streamed(agent, input=user_message, run_config=run_config)

      async for adapted in adapt_stream(result, session_id=session_id):
        if adapted.get("type") == "chunk":
          emitted_content = True
        if adapted.get("type") == "error":
          hit_error = True
          last_error = adapted
          if not emitted_content and has_more:
            # Swallow the error and switch to the next provider.
            yield {
              "type": "provider_switched",
              "from": rp.label,
              "to": providers[idx + 1].label,
              "reason": adapted.get("error", "provider error"),
            }
            break
          # Otherwise surface the error and stop.
          yield adapted
          used_holder.append(rp)
          return
        else:
          yield adapted

      if not hit_error:
        used_holder.append(rp)
        return
      # hit_error + switched: continue to next provider

    except Exception as e:  # noqa: BLE001 — provider/client construction errors
      logger.error(
        "Provider failed in fallback chain",
        provider=rp.label,
        error_type=type(e).__name__,
        error=str(e)[:200],
      )
      last_error = {
        "type": "error",
        "error": str(e)[:200],
        "error_code": "internal",
        "recoverable": False,
      }
      if not emitted_content and has_more:
        yield {
          "type": "provider_switched",
          "from": rp.label,
          "to": providers[idx + 1].label,
          "reason": str(e)[:200],
        }
        continue
      raise

  # Exhausted the chain without success.
  if last_error is not None:
    yield last_error

"""Tool timeout utilities.

Wraps function-tool execution with ``asyncio.wait_for`` so that
a slow tool call doesn't hang the agent loop indefinitely.
"""

from __future__ import annotations

import asyncio
import functools

TOOL_TIMEOUT_SECONDS = 30


async def rollback_quietly(db) -> None:
  """Roll back a possibly-aborted session so later tools can reuse it.

  Tools share one per-request ``AsyncSession``. If a query errors, asyncpg
  leaves the transaction in an aborted state and every subsequent query
  fails with ``InFailedSQLTransactionError``. Calling this in a tool's
  error handler clears that state. Safe to call when ``db`` is ``None``.
  """
  if db is None:
    return
  try:
    await db.rollback()
  except Exception:  # noqa: BLE001 — best-effort cleanup
    pass


def with_timeout(timeout: int | None = None):
  """Decorator that wraps a tool function with an execution timeout.

  Apply **below** (inside of) ``@function_tool`` so the SDK still sees
  the original function signature::

      @function_tool
      @with_timeout()
      async def my_tool(...) -> str:
          ...

  When the tool times out, it returns an error string the agent can
  read and continue from, rather than hanging forever.
  """

  def decorator(func):
    @functools.wraps(func)
    async def wrapper(*args, **kwargs):
      # Serialize tool execution: the SDK can run several tool calls from one
      # model turn concurrently, but they share one AsyncSession which cannot
      # be used concurrently. The lock ensures one tool runs at a time.
      try:
        from app.services.ai.agent.context import get_tool_lock

        lock = get_tool_lock()
      except Exception:  # noqa: BLE001 — never block tool execution on lock setup
        lock = None

      try:
        if lock is not None:
          async with lock:
            return await asyncio.wait_for(
              func(*args, **kwargs),
              timeout=timeout or TOOL_TIMEOUT_SECONDS,
            )
        return await asyncio.wait_for(
          func(*args, **kwargs),
          timeout=timeout or TOOL_TIMEOUT_SECONDS,
        )
      except asyncio.TimeoutError:
        return (
          f"Error: Tool '{func.__name__}' timed out after "
          f"{timeout or TOOL_TIMEOUT_SECONDS}s. "
          f"The agent will continue."
        )

    return wrapper

  return decorator

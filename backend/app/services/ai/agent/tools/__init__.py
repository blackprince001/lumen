"""Tool timeout utilities.

Wraps function-tool execution with ``asyncio.wait_for`` so that
a slow tool call doesn't hang the agent loop indefinitely.
"""

from __future__ import annotations

import asyncio
import functools

TOOL_TIMEOUT_SECONDS = 30


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
            try:
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

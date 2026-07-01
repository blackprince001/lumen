---
type: ADR
title: Per-stream DB session for SSE generators
description: streaming endpoints use stream_db_session() (a fresh AsyncSession inside the streaming task) so the request-scoped session is not reused across Starlette's separate streaming task.
tags: [adr, backend, database, sse, asyncpg]
timestamp: 2026-06-28T00:00:00Z
---

# Decision

SSE/`StreamingResponse` endpoints use `stream_db_session()` — an async
contextmanager that opens a **fresh** `AsyncSession` inside the streaming
task — rather than reusing the request-scoped session from `get_session()`.

# Why

Starlette runs a `StreamingResponse` generator in a **separate task** from the
one that handled the request. Reusing the request-scoped async session across
tasks triggers the asyncpg `MissingGreenlet` error. A fresh session inside the
streaming task sidesteps the cross-task session problem entirely.

# Tradeoffs

- + Avoids `MissingGreenlet`; correct async lifetime in streamed handlers.
- − Slight session overhead per stream (a second connection held for the
  stream's duration); mitigated by short-lived AI streams.
- − Two session-acquisition patterns to know: `Depends(get_db)` for normal
  routes, `async with stream_db_session()` for streams.

# Alternatives considered

- Bind the session with `expire_on_commit=False` and share it — does not solve
  the cross-task/greenlet problem.
- Run DB work before streaming and pass data in — rejected for chat, which
  needs DB access during streaming (tool calls).

# Citations

[1] [`backend/app/core/database.py:60-82`](/backend/database.md) — `stream_db_session()`.
[2] [/backend/api/chat.md](/backend/api/chat.md) — streaming endpoints that use it.
---
type: ADR
title: Structured AI error codes over SSE
description: A fixed error-code taxonomy (AUTH/RATE_LIMIT/MAX_TURNS/TIMEOUT/NETWORK/NO_PROVIDER/PROVIDER_UNAVAILABLE/TOOL_ERROR/INTERNAL) is surfaced over SSE for typed client handling.
tags: [adr, ai, error-handling, sse]
timestamp: 2026-06-28T00:00:00Z
---

# Decision

The AI agent layer emits a structured error code over SSE rather than opaque
HTTP errors or free-text. `services/ai/agent/error.py` defines
`ERROR_CODE_AUTH`, `_RATE_LIMIT`, `_MAX_TURNS`, `_TIMEOUT`, `_NETWORK`,
`_NO_PROVIDER`, `_PROVIDER_UNAVAILABLE`, `_TOOL_ERROR`, `_INTERNAL`, plus
`classify_exception` and `build_error_message`. The frontend `useChatStream`
keys typed-error handling off these codes.

# Why

- Streaming endpoints cannot rely on HTTP status once 200 has been sent; a
  code in the stream is the cleanest signal.
- Lets the client render specific UX (retry on RATE_LIMIT, re-auth on AUTH,
  silent on MAX_TURNS) without parsing text.
- Centralizes "what can go wrong in an agent run" in one enum.

# Tradeoffs

- + Typed, debuggable, consistent across providers.
- − Enum must stay in sync between server (`error.py`) and frontend
  (`useChatStream`).
- − Some provider-specific failures collapse into a shared bucket
  (PROVIDER_UNAVAILABLE).

# Alternatives considered

- HTTP status codes only — not usable mid-stream after 200.
- Free-text error messages — fragile for client logic.

# Citations

[1] [`backend/app/services/ai/agent/error.py`](/backend/services/ai-agent.md)
[2] [`frontend-v2/src/hooks/use-chat-stream.ts:89`](/frontend/chat-system.md) — typed-error consumer.
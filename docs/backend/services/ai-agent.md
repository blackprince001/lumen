---
type: Module
title: AI Agent Orchestration (openai-agents SDK)
description: How chat and feature generation run — MultiProviderBuilder routing across user providers, function tools, the SSE stream adapter, BYOContext for permission scoping, and the optional-SDK fallback.
resource: backend/app/services/ai/agent
tags: [backend, ai, agent, sse, streaming, tools]
timestamp: 2026-06-28T00:00:00Z
---

`backend/app/services/ai/agent/` orchestrates chat/feature generation through
the openai-agents SDK. The SDK is **optional** — see
[/decisions/optional-agents-sdk.md](/decisions/optional-agents-sdk.md).

# Entry: `MultiProviderBuilder` (`multi_provider.py`)

Routes a model request to the user's configured provider by constructing an
`OpenAIProvider`/`RunConfig` (see `run_config.py`). Used by
`services/chat.py` and `services/multi_chat.py`.

# BYO context (`context.py`)

`BYOContext` is a **contextvar** that carries the current user/identity into
function tools for permission scoping. Tools read it rather than taking a
`user` argument — keeps tool signatures SDK-friendly.

# Agents (`agents.py`)

Agent definitions for chat, discovery, etc. Each agent gets a tool set and a
run config; the run is the SDK's `Runner`.

# Function tools (`tools/`)

| File | Tools |
|---|---|
| `paper_tools.py` | paper text / metadata / annotations / citation retrieval |
| `chat_history.py` | chat history retrieval for multi-turn coherence |
| `rag_tool.py` | `semantic_search` via pgvector cosine similarity (768-dim) |
| `discovery_tools.py` | arXiv, Semantic Scholar, Google Scholar, OpenAlex search + Google via SerpAPI with DuckDuckGo fallback |
| `figure_tools.py` | render figures → PNG → send to a vision-capable provider |

# Stream adapter (`stream_adapter.py`)

Converts openai-agents streaming events into the app's SSE event format
consumed by the frontend `chatStream.ts` / `parseSSE.ts` (see
[/frontend/chat-system.md](/frontend/chat-system.md)). SSE events include
`content` deltas, `tool_call`/`tool_result`/`thought` indicators, and typed
errors.

# Errors (`error.py`)

Structured error-code taxonomy surfaced over SSE:
`ERROR_CODE_AUTH`, `_RATE_LIMIT`, `_MAX_TURNS`, `_TIMEOUT`, `_NETWORK`,
`_NO_PROVIDER`, `_PROVIDER_UNAVAILABLE`, `_TOOL_ERROR`, `_INTERNAL`. Plus
`classify_exception` and `build_error_message`. See
[/decisions/structured-ai-errors.md](/decisions/structured-ai-errors.md).

# Optional SDK + legacy fallback

`agent/__init__.py:31-56` lazily imports SDK-dependent exports and falls back
to `None`. `services/chat.py` and `services/multi_chat.py` then fall back to
the legacy `provider.generate()` path when the SDK is absent — so the app
still works in environments without the openai-agents SDK installed.

# Supporting files

- `provider_resolver.py` — resolves the correct provider per user.
- `paper_meta.py` — paper metadata helpers packed into agent context.
- `fallback_runner.py` — legacy non-SDK runner.
- `sdk_patches.py` — runtime patches for the openai-agents SDK.
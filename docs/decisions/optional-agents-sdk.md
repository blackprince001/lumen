---
type: ADR
title: Optional openai-agents SDK with legacy fallback
description: The agents SDK is imported lazily; chat/multi_chat fall back to legacy provider.generate() when it is unavailable, so the app still runs.
tags: [adr, ai, agent, sdk, compatibility]
timestamp: 2026-06-28T00:00:00Z
---

# Decision

The `openai-agents` SDK is loaded **lazily** — `services/ai/agent/__init__.py:31-56`
imports SDK-dependent exports and falls back to `None`. `services/chat.py` and
`services/multi_chat.py` then fall back to the legacy `provider.generate()`
path when the SDK is absent.

# Why

- Lets the app run in environments without the agents SDK installed.
- Allows incrementally migrating provider integrations to the SDK without a
  flag day; providers not yet OpenAI-compatible keep working via the legacy
  runner (`agent/fallback_runner.py`).
- Isolates SDK breakage: a bad SDK release degrades to legacy behavior rather
  than breaking chat entirely.

# Tradeoffs

- + No hard install dependency for chat; graceful degradation.
- − Two code paths to maintain (SDK-streamed events vs legacy `generate`).
- − The `stream_adapter.py` must stay in sync with the legacy output shape.

# Alternatives considered

- Hard dependency on the agents SDK with no fallback — rejected for
  environment/compat risk.
- Inline the SDK entirely — rejected; the SDK is large and we want fallback.

# Citations

[1] [`backend/app/services/ai/agent/__init__.py:31-56`](/backend/services/ai-agent.md)
[2] [`backend/app/services/chat.py`](/backend/services/services-catalog.md) — legacy `provider.generate()` fallback.
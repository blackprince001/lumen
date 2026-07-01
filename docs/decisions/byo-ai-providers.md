---
type: ADR
title: Per-user BYO AI providers
description: Generation runs against each user's own (Fernet-encrypted) provider key; the only server-side key is GOOGLE_API_KEY, used strictly for embeddings.
tags: [adr, ai, security, byo]
timestamp: 2026-06-28T00:00:00Z
---

# Decision

Chat and AI-feature generation runs against per-user "bring-your-own"
providers: each user configures `UserAISettings` + `UserAIProvider` rows
(provider type, optionally Fernet-encrypted API key, `base_url`, `model`).
The **only** server-side key is `GOOGLE_API_KEY`, used strictly for
**embeddings** (`gemini-embedding-001`, 768-dim). There is no env-key fallback
for generation.

# Why

- The app is multi-tenant and self-hosted; centralizing provider billing/keys
  was undesirable and would create a single cost/quota bottleneck.
- Users bring their own provider accounts/quota; the server never needs to see
  plaintext keys except transiently at runtime.
- Keeps embeddings (which need a single corpus-side model) on the server while
  letting generation vary per user.

# Tradeoffs

- + Per-user cost/quota isolation; no central key to leak.
- + Provider flexibility (Gemini, OpenAI, Anthropic, DeepSeek, OpenAI-compatible).
- − More moving parts: an `AIProviderRegistry`, per-request provider
  resolution, at-rest Fernet encryption of keys, a connection-test endpoint.
- − The server still holds a key for embeddings; that key's quota is shared.

# Alternatives considered

- A single server-side multi-provider key rotated centrally — rejected on
  cost/quota centralization and key-leak blast radius.
- No embeddings server-side (BYO embeddings too) — rejected: the corpus
  embedding consistency requires one embedding model.

# Citations

[1] [`backend/app/core/config.py:21-23`](/backend/config.md) — comment confirming chat providers are per-user.
[2] [`backend/app/services/ai/providers/registry.py`](/backend/services/ai-providers.md)
[3] [`backend/app/core/encryption.py`](/backend/security.md) — Fernet at-rest key encryption.
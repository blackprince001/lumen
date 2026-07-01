---
type: Module
title: AI Provider Abstraction & Registry
description: The BaseAIService/AIProvider abstraction layer that lets any chat or feature call run against a user-configured Gemini/OpenAI/Anthropic/DeepSeek/OpenAI-compatible provider.
resource: backend/app/services/ai/providers
tags: [backend, ai, providers, byo, gemini, openai, anthropic, deepseek]
timestamp: 2026-06-28T00:00:00Z
---

`backend/app/services/ai/` is the provider abstraction layer.

# `providers/base.py`

`AIProvider` ABC + `ProviderConfig` dataclass. Implemented by every provider
class.

# `providers/registry.py`

`ai_provider_registry` singleton maps provider-type strings → classes.
Registered types:

| Type | Class | Client |
|---|---|---|
| `gemini` | `providers/gemini.py` | `google.genai` |
| `openai` | `providers/openai_compatible.py` | `openai.AsyncOpenAI` |
| `openai-compatible` | `providers/openai_compatible.py` | `openai.AsyncOpenAI` (custom `base_url`) |
| `deepseek` | `providers/openai_compatible.py` | `openai.AsyncOpenAI` |
| `anthropic` | `providers/openai_compatible.py` | `openai.AsyncOpenAI` |

# `provider_factory.py` / `helpers.py`

`AIProvider` instances are built from a user's `UserAISettings` (type +
Fernet-decrypted key + optional `base_url` + `model`). `helpers.py` resolves
the correct provider per request — see [ai-agent.md](/backend/services/ai-agent.md)
for the runtime resolution path.

# Resource-listing & testing

`/ai/models` (OpenRouter catalog) and `/ai/providers/test` (connection smoke
test) are exposed on the `ai-settings` router — see
[ai.md](/backend/api/ai.md).

# Note on embeddings

The **Google-only** embedding service (`services/embeddings.py`) uses
`GOOGLE_API_KEY` directly (`gemini-embedding-001`, 768-dim). Embeddings are
**not** part of the BYO system — only chat/feature generation is. See the
[BYO decision](/decisions/byo-ai-providers.md).
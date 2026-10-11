---
type: ADR
title: List models from the provider's own API, not OpenRouter
description: >
  The provider settings model picker asks each provider's native /models
  endpoint with the user's key, and saves are checked against that list.
  The OpenRouter catalog is removed.
tags: [adr, ai, providers, models]
timestamp: 2026-10-11
---

# Context

The model picker was filled from OpenRouter's public catalog. OpenRouter IDs
are its own slugs and can carry variant suffixes (`:batch`, `:free`). Users
picked names like `deepseek-v4.1-flash:batch`, saved them, and every call
then failed with a 400 from DeepSeek, which only accepts its own names. The
catalog also listed models a given key could not use.

# Decision

Ask the provider directly, with the user's key, through
`backend/app/services/ai/model_catalog.py`. Hosted providers (OpenAI,
Anthropic, DeepSeek, Gemini) are filtered to chat models; self-hosted
endpoints are listed as-is. Creating or updating a hosted provider fails with
422 when the model is not in that list, and 502 when the provider cannot be
reached. Self-hosted models are not checked, since some servers don't expose
`/models`. This mirrors the approach in the Learning-app repo.

# Consequences

- A stored model name is one the provider accepts for that key.
- The picker needs a key (or a saved provider) before it can show models.
- Saving a hosted provider now depends on the provider answering `/models`.
- `GET /ai/models` is gone; the settings page was its only caller.

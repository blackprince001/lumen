---
type: API Collection
title: AI Features API
description: AI-generated paper summaries, key findings, reading guides, smart highlights, selection actions, and per-user BYO AI provider/settings management with connection testing.
resource: backend/app/api/ai_features.py
tags: [backend, api, ai, byo]
timestamp: 2026-06-28T00:00:00Z
---

Three routers under prefix `/api/v1`: `ai_features.py` (tag `ai-features`),
`user_ai_settings.py` (tag `ai-settings`), `user_ai_providers.py` (tag
`ai-providers`). All generation runs per-user BYO providers — see
[ai-agent.md](/backend/services/ai-agent.md).

# `ai_features.py` — generate / get / put artifacts

| Method | Path | Line | Notes |
|---|---|---|---|
| POST | `/papers/{paper_id}/ai-actions` | `:47` | selection actions (explain/why/define) |
| POST / GET / PUT | `/papers/{paper_id}/summary` variants | `:114 / :130 / :154` | generate / get / put summary |
| POST / GET / PUT | `/papers/{paper_id}/findings` variants | `:177 / :191 / :213` | key findings |
| POST / GET / PUT | `/papers/{paper_id}/reading-guide` variants | `:232 / :248 / :270` | reading guide |
| POST | `/papers/{paper_id}/generate-highlights` | `:289` | smart highlights |

These usually enqueue the matching Celery tasks in [tasks.md](/backend/tasks.md)
(`generate_summary_task`, `extract_findings_task`, `generate_reading_guide_task`,
`generate_highlights_task`) and may stream results.

# `user_ai_settings.py` — the BYO settings entity

| Method | Path | Line | Notes |
|---|---|---|---|
| GET / PUT / PATCH / DELETE | `/user/ai-settings` | `:98/:113/:139/:155` | full lifecycle |
| GET | `/ai/providers` | `:167` | list registered provider types |
| GET | `/ai/models` | `:176` | list models from OpenRouter |
| POST | `/ai/providers/test` | `:185` | smoke-test a provider config |

# `user_ai_providers.py` — multiple providers, one default

| Method | Path | Line | Notes |
|---|---|---|---|
| GET / POST | `/user/ai-providers` | `:23 / :36` | list / create |
| PATCH | `/user/ai-providers/{provider_id}` | `:51` | |
| PUT | `/user/ai-providers/{provider_id}/default` | `:68` | sets default (clears others) |
| DELETE | `/user/ai-providers/{provider_id}` | `:84` | |

CRUD helpers are in `crud/user_ai_provider.py` and `crud/user_ai_settings.py`
— see [crud.md](/backend/crud.md). API keys are Fernet-encrypted at rest —
see [security.md](/backend/security.md).
---
type: API Collection
title: Discovery API
description: Multi-source academic search (arXiv, Semantic Scholar, OpenAlex, Google Scholar), AI-enhanced streaming search, paper recommendations, citation explorer, discovery sessions, and HuggingFace Daily Papers.
resource: backend/app/api/discovery.py
tags: [backend, api, discovery, search, sse]
timestamp: 2026-06-28T00:00:00Z
---

Two routers mounted under prefix `/api/v1/discovery` (tag `discovery`) and
`/api/v1/huggingface` (tag `huggingface`).

# `discovery.py`

### Sources & search

| Method | Path | Line | Notes |
|---|---|---|---|
| GET | `/discovery/sources` | `:65` | list enabled discovery sources |
| POST | `/discovery/search` | `:74` | multi-provider search (sync) |
| POST | `/discovery/ai-search` | `:152` | AI-enhanced search (non-stream) |
| POST | `/discovery/ai-search/stream` | `:386` | **SSE** AI search (see frontend `useAISearchStream`) |

### Paper details & library add

| Method | Path | Line |
|---|---|---|
| GET | `/discovery/paper/{source}/{external_id}` | `:624` |
| POST | `/discovery/paper/{discovered_paper_id}/add-to-library` | `:651` |
| POST | `/discovery/batch/add-to-library` | `:719` |

### Citations & recommendations

| Method | Path | Line |
|---|---|---|
| POST | `/discovery/citations` | `:781` | citation explorer |
| POST | `/discovery/recommendations` | `:863` | "For You" recommendations |

### Cache & sessions

| Method | Path | Line |
|---|---|---|
| GET | `/discovery/cached` | `:967` |
| GET / POST | `/discovery/sessions` | `:1011 / :1044` |
| GET | `/discovery/sessions/{session_id}` | `:1080` |
| DELETE / PUT | `/discovery/sessions/{session_id}` | `:1133 / :1155` |

### Authors

| Method | Path | Line |
|---|---|---|
| GET | `/discovery/authors/search` | `:1198` |
| GET | `/discovery/authors/{author_id}/works` | `:1266` |

# `huggingface.py`

GET `/huggingface/daily-papers` (`:15`) — HuggingFace Daily Papers via
`huggingface_service`. Schemas in `schemas/huggingface.py`.

# Providers

Backed by `services/discovery/` — see
[discovery-providers.md](/backend/services/discovery-providers.md). Per-source
search runs as the `search_source_task` Celery task (progress pushed over
Redis); AI enhancement runs as `ai_enhance_task` — see
[tasks.md](/backend/tasks.md). The frontend AI-search streaming client is
documented in [/frontend/chat-system.md](/frontend/chat-system.md).
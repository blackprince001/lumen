---
type: Module
title: CRUD Layer
description: Where create/update/delete logic lives — the api/crud/ reusable helpers (with scoping) and the top-level crud/ modules for user AI config.
resource: backend/app/api/crud
tags: [backend, crud, data-access]
timestamp: 2026-06-28T00:00:00Z
---

Papers splits CRUD logic across **two** locations. Read this before adding a
new data-access helper — it is easy to put one in the wrong place.

# `api/crud/` — shared helpers used by route handlers

Reusable async functions consumed directly by the 21 route modules:
`get_*_or_404`, `list_*`, `create_*`, etc. Centralizes **permission scoping**
via `app.services.access` (`apply_visible_papers_filter`,
`visible_groups_clause`). Covers papers, annotations, bookmarks, groups,
tags, chat sessions, saved searches, user paper state, sharing.

# `crud/` (top-level) — user AI configuration only

Currently covers only the per-user AI configuration entities:

| File | Entity | Key functions |
|---|---|---|
| `crud/user_ai_provider.py` | `UserAIProvider` | `list_*`, `get_*`, `get_default_provider`, `create_*`, `update_*`, `set_default_provider` (clears other defaults), `delete_*` |
| `crud/user_ai_settings.py` | `UserAISettings` | `get_*`, `create_*`, `update_*`, `delete_*` |

# Why the split

The top-level `crud/` package was introduced for the BYO AI config feature
(the most recently added domain). All earlier entities still live in
`api/crud/`. When adding new domain CRUD, prefer mirroring the existing
location for that domain. See the access helpers in
[services](/backend/services/index.md).
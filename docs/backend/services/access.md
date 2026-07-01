---
type: Module
title: Access & Permissions Helpers
description: Ownership-scoping query helpers that let one query path serve both admins (see all) and users (scoped) — apply_visible_papers_filter and visible_groups_clause.
resource: backend/app/services/access.py
tags: [backend, access, permissions, multi-tenancy]
timestamp: 2026-06-28T00:00:00Z
---

`backend/app/services/access.py` implements the central visibility/permission
helpers used by CRUD and route handlers across the app.

# Functions

- `apply_visible_papers_filter(query, user, ...)` — restricts a `Paper` query
  to papers the user can see (owned + shared with them via `PaperShare`/
  `GroupShare`).
- `visible_groups_clause(user, ...)` — same for `Group` queries.
- `get_effective_paper_permission(paper, user)` — returns the permission
  level for a given (paper, user) pair (e.g. owner / editor / viewer); used by
  the frontend's `lib/utils/permissions.ts` mirrors — see
  [/frontend/pdf-reader.md](/frontend/pdf-reader.md).

# Scoping hook

All of these are driven by `scoped_user_id(user)` from
[dependencies.md](/backend/dependencies.md): `None` for admins → no filter
(see all); `user.id` for regular users → ownership filter. This keeps the
admin-vs-user path difference to a single value.
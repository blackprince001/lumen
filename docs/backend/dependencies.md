---
type: Module
title: Shared Dependencies
description: FastAPI dependency providers — auth, async DB session, paper lookup, and the admin-vs-user ownership scoping helper.
resource: backend/app/dependencies.py
tags: [backend, fastapi, auth, di]
timestamp: 2026-06-28T00:00:00Z
---

`backend/app/dependencies.py` centralizes shared FastAPI dependencies.

# Provided dependencies

| Name | Returns | Notes |
|---|---|---|
| `get_db()` | `AsyncSession` (yield) | from `get_session()` (`dependencies.py:19-21`) |
| `get_current_user(...)` | `User` | decodes JWT Bearer, loads `User`, raises 401/403 (`dependencies.py:24-55`) |
| `require_admin(...)` | `User` | wraps `get_current_user`, requires `user.role == "admin"` (`dependencies.py:58-64`) |
| `get_optional_user(...)` | `User \| None` | never raises (`dependencies.py:67-77`) |
| `get_paper_or_404(...)` | `Paper` | path-param `paper_id` → `Paper` with eager-loaded `tags`, or 404 (`dependencies.py:91-107`) |
| `scoped_user_id(user)` | `int \| None` | `None` for admins (see all) else `user.id` for ownership filtering (`dependencies.py:86-88`) |

# Annotated type aliases

For clean signatures (`dependencies.py:81-83,111`): `CurrentUser`,
`AdminUser`, `OptionalUser`, `PaperDep`.

The Bearer scheme is module-level: `_bearer_scheme = HTTPBearer(auto_error=False)`
(`dependencies.py:16`) so the bearer is **optional** — endpoints that require
auth fail inside `get_current_user`, not via the scheme.

# Multi-tenancy / ownership scoping

`scoped_user_id(user)` is the single hook for visibility. It returns `None`
for admins (no ownership filter → see all) and `user.id` for regular users.
This value is threaded into `apply_visible_papers_filter` /
`visible_groups_clause` in `services/access` so one query path serves both
roles. See the auth flow in [security.md](/backend/security.md).
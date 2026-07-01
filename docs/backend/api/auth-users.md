---
type: API Collection
title: Auth & Users API
description: Google OAuth ID-token login, admin username/password login, JWT refresh-token rotation, profile, and admin-only user management/analytics.
resource: backend/app/api
tags: [backend, api, auth, users]
timestamp: 2026-06-28T00:00:00Z
---

Two routers under prefix `/api/v1`: `auth.py` (tag `auth`, no auth dep) and
`users.py` (tag `users`, admin-only).

# `auth.py`

| Method | Path | Line | Rate limit | Notes |
|---|---|---|---|---|
| POST | `/auth/google` | `:85` | 20/min | verify Google ID token → upsert by `google_id`/`email` → `_issue_tokens` |
| POST | `/auth/admin/login` | `:132` | 5/min | compare vs base64 env admin creds |
| POST | `/auth/refresh` | `:169` | 10/min | rotate refresh → new access; reads httpOnly cookie |
| POST | `/auth/logout` | `:227` | — | revoke refresh, clear cookie |
| GET | `/auth/me` | `:248` | — | current user profile |
| PATCH | `/auth/me` | `:254` | — | update own profile |

# `users.py` (admin-only)

| Method | Path | Line | Notes |
|---|---|---|---|
| GET | `/users` | `:23` | list users |
| GET | `/users/{user_id}` | `:52` | returns `UserAnalytics` |
| PATCH | `/users/{user_id}` | `:93` | update user |
| DELETE | `/users/{user_id}` | `:132` | delete user |

# Token lifecycle

See [security.md](/backend/security.md) for the JWT + refresh + Fernet
details, and [/frontend/auth-flow.md](/frontend/auth-flow.md) for the SPA side
of the dual-token flow.
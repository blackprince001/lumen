---
type: Module
title: Security & Encryption
description: JWT access + refresh-token rotation, httpOnly refresh cookie, Google OAuth ID-token verification, admin base64 credentials, and Fernet at-rest key encryption.
resource: backend/app/core/security.py
tags: [backend, security, auth, jwt, encryption]
timestamp: 2026-06-28T00:00:00Z
---

`backend/app/core/security.py` + `backend/app/core/encryption.py`.

# Tokens (security.py)

- `create_access_token` / `verify_access_token` — JWT HS256, 30-min lifetime
  (`ACCESS_TOKEN_EXPIRE_MINUTES`), payload `sub=user_id` + role + email.
- `create_refresh_token` / `hash_token` / `get_refresh_token_expiry` — opaque
  refresh token; hash stored in the `RefreshToken` table. Refresh sent as an
  **httpOnly cookie** `refresh_token` (7-day, `samesite=lax`). The refresh
  endpoint implements **token rotation**: revokes the presented refresh and
  issues a new one.
- `verify_google_id_token` — uses `google.oauth2.id_token` to verify Google
  OAuth ID tokens.
- `decode_admin_credentials` — base64-decodes `ADMIN_USERNAME` /
  `ADMIN_PASSWORD` env vars.
- `hash_password` / `verify_password` — passlib-style (bcrypt, pinned <4.0).

# Auth endpoints (api/auth.py)

| Method | Path | Rate limit | Notes |
|---|---|---|---|
| POST | `/auth/google` | Google 20/min | verify ID token → upsert user by `google_id`/`email` → `_issue_tokens` mints access + refresh |
| POST | `/auth/admin/login` | 5/min | compare vs env admin creds |
| POST | `/auth/refresh` | 10/min | rotate refresh → new access |
| POST | `/auth/logout` | — | revoke refresh, clear cookie |
| GET/ PATCH | `/auth/me` | — | profile get/update |

Admin user is seeded on startup by `seed_admin_user()` in `main.py:41-89`.

# Rate limiting

`rate_limit(request, max, window)` is a Redis-backed FastAPI dependency
(`core/rate_limit.py`) raising 429. Rates above are applied at the auth
endpoints.

# At-rest encryption (encryption.py)

Fernet (AES-128-CBC) symmetric encryption. Primary key derives from
`AI_KEY_ENCRYPTION_KEY` when set; a `JWT_SECRET_KEY`-derived key is retained
as decrypt-only fallback via `MultiFernet` (see
[decision](/decisions/separate-encryption-key.md)).
`encrypt_value`/`decrypt_value` store **per-user AI provider API keys** at
rest — this is how BYO keys never sit plaintext in the DB. See [ai-agent.md](/backend/services/ai-agent.md) for how the decrypted key
reaches the provider at runtime.

# Auth flow (full)

See the frontend side of the dual-token flow in
[/frontend/auth-flow.md](/frontend/auth-flow.md).
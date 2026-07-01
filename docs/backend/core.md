---
type: Module
title: Core Package
description: Cross-cutting infrastructure under backend/app/core/ — settings, async+sync DB, security, encryption, logging, rate limiting.
resource: backend/app/core
tags: [backend, core, config, database, security]
timestamp: 2026-06-28T00:00:00Z
---

`backend/app/core/` holds cross-cutting infrastructure shared by routers,
services, and tasks. Each submodule has its own concept doc.

| File | Provides | Concept |
|---|---|---|
| `config.py` | `Settings(BaseSettings)` singleton `settings`; derived `REDIS_URL`, `CELERY_BROKER_URL`, `CELERY_RESULT_BACKEND`; auto-builds `DATABASE_URL`; auto-generates `JWT_SECRET_KEY` if unset | [/backend/config.md](/backend/config.md) |
| `database.py` | async engine + `AsyncSessionLocal` (FastAPI); sync engine + `SyncSessionLocal` (Celery); `Base`; `get_session()`, `stream_db_session()`, `init_db()`, `close_db()` | [/backend/database.md](/backend/database.md) |
| `security.py` | `hash_password`/`verify_password`, `create_access_token`/`verify_access_token` (JWT HS256, 30 min), `create_refresh_token`/`hash_token`, `verify_google_id_token`, `decode_admin_credentials` | [/backend/security.md](/backend/security.md) |
| `encryption.py` | Fernet (AES-128-CBC) symmetric encryption keyed from `JWT_SECRET_KEY`; `encrypt_value`/`decrypt_value` for storing user API keys at rest | [/backend/security.md](/backend/security.md) |
| `logger.py` | `configure_logging(is_debug)` + `get_logger(name)` — structlog JSON-formatted, context-rich logging | (see below) |
| `rate_limit.py` | Redis-backed `rate_limit(request, max_requests, window_seconds)` dependency; raises 429; lazy `_get_redis()` singleton | (see below) |

# Logger

`configure_logging(is_debug)` + `get_logger(name)` (`logger.py:14,59`).
structlog, JSON-formatted, context-rich. All modules should obtain a logger via
`get_logger(__name__)` rather than the stdlib `logging`.

# Rate limiter

`rate_limit(request, max_requests, window_seconds)` is a FastAPI dependency
backed by Redis (`rate_limit.py:13`). On over-limit it raises `HTTPException`
with status 429. `_get_redis()` is a lazy singleton. Auth endpoints use this:
Google 20/min, admin login 5/min, refresh 10/min — see
[entry-point.md](/backend/entry-point.md) and [security.md](/backend/security.md).
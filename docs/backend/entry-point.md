---
type: Module
title: Application Entry Point
description: FastAPI app factory wiring 21 routers under /api/v1, lifespan startup, and built-in health/info routes.
resource: backend/app/main.py
tags: [backend, fastapi, entry-point]
timestamp: 2026-06-28T00:00:00Z
---

`backend/app/main.py` constructs the FastAPI application, wires every router,
runs startup side effects, and exposes three built-in routes.

# App construction

`FastAPI(title="Papers Research Engine", version="1.0.0", lifespan=lifespan,
docs_url=None, redoc_url=None)` (`main.py:99-105`). OpenAPI docs are served
separately via Scalar at `/api-docs` (see Built-in routes below).

# Lifespan

`async with` context manager (`main.py:92-96`). On startup:

1. `await init_db()` — creates the `vector` extension + tables (see
   [database.md](/backend/database.md)).
2. `await seed_admin_user()` (`main.py:41-89`) — creates/updates an admin
   user from `ADMIN_USERNAME`/`ADMIN_PASSWORD` env vars (base64-decoded).

# Middleware

Only `CORSMiddleware` (`main.py:112-118`). Allowed origins = the list
`[settings.FRONTEND_URL]`, extended with `http://localhost:5173` and
`http://localhost:3000` when `DEBUG`. Credentials, all methods, all headers.

# Router wiring

21 routers, all under prefix `/api/v1` (some with additional sub-prefixes,
e.g. `discovery`, `tasks`, `huggingface`). Auth wiring:

- `auth_router` — no dependency.
- `users_router` — `_admin_dep` (`require_admin`).
- all others — `_auth_dep` (`get_current_user`).

Tags: `auth`, `users`, `ingest`, `relationships`, `citation-map`, `papers`,
`annotations`, `groups`, `search`, `chat`, `multi-chat`, `tags`, `ai-settings`,
`ai-providers`, `statistics`, `export`, `duplicates`, `ai-features`,
`discovery`, `tasks`, `huggingface`. The full per-domain endpoint catalog is in
[/backend/api/index.md](/backend/api/index.md).

# Built-in routes (`main.py:200-249`)

| Method | Path | Purpose |
|---|---|---|
| GET | `/` | Welcome message |
| GET | `/api-docs` | Scalar API reference (`include_in_schema=False`) |
| GET | `/health` | Checks Redis (`redis.Redis.ping()`) + Celery workers (`celery_app.control.inspect().stats()`); returns `healthy`/`degraded` with component detail |

# Exception handling

`register_exception_handlers(app)` (`app/core/error_handlers.py`, wired in
`main.py`) provides the global error envelope `{code, message, detail}` for
`HTTPException`, 422 validation errors (`+ errors` list), and unhandled
exceptions (logged, generic 500). See
[http-error-envelope](/decisions/http-error-envelope.md). The AI agent layer
separately surfaces structured error codes over SSE
([structured-ai-errors](/decisions/structured-ai-errors.md)).
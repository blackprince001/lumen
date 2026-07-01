---
type: ADR
title: Alembic owns the schema; init_db only ensures the vector extension
description: Removed Base.metadata.create_all from production startup — migrations are the single source of schema truth; create_all remains a DEBUG-only convenience.
tags: [adr, database, migrations]
timestamp: 2026-07-01T00:00:00Z
---

# Status

Accepted (2026-07-01, reformation batch 1).

# Context

`init_db()` ran `CREATE EXTENSION IF NOT EXISTS vector` **and**
`Base.metadata.create_all` on every startup, while the container CMD already
runs `alembic upgrade head` before uvicorn (`backend/Dockerfile:31`). The
redundant `create_all` masked schema drift: a model change without a
migration would silently materialize in prod.

# Decision

`init_db()` ([/backend/database.md](/backend/database.md)) only ensures the
`vector` extension. `create_all` runs solely when `DEBUG=true`, as a local
convenience for running without migrations. Alembic is the single owner of
the schema in non-debug environments.

# Consequences

- Prod-mode runs outside the Docker CMD must run `alembic upgrade head`
  manually before starting the app.
- Model changes now *require* a migration to take effect outside DEBUG —
  drift surfaces as an error instead of hiding.

# Citations

[1] Reformation backend pitfall #1 — [/reformation.md](/reformation.md).

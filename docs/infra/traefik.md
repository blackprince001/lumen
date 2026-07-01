---
type: Infrastructure
title: Traefik Configuration
description: Traefik v2 routing labels, Let's Encrypt TLS (prod), the security-headers and fix-js-mime-types file middlewares, and the init-db.sql vector-extension init script.
resource: middlewares.yml
tags: [infra, traefik, tls, middlewares]
timestamp: 2026-06-28T00:00:00Z
---

Traefik v2.11 is the reverse proxy for both dev and prod. Routing is driven
by Docker labels on the compose services (see [docker.md](docker.md)).

# Let's Encrypt (prod only)

Prod enables `websecure` (`:443`) + the `leresolver` ACME HTTP challenge, plus
an HTTP→HTTPS redirect on the `web` entrypoint (`docker-compose.prod.yml:12-18`).
`./letsencrypt:/letsencrypt` is mounted for certificate persistence
(`:23-25`). TLS is attached per-router via the `leresolver` TLS setting.

# `middlewares.yml` — file-provider middlewares (`:1-20`)

- **`security-headers`** (`:3-15`): `frameDeny`, `sslRedirect`,
  `browserXssFilter`, `contentTypeNosniff`, `forceSTSHeader`,
  `stsIncludeSubdomains`, `stsPreload`, `stsSeconds: 31536000` (1 year),
  `customFrameOptionsValue: "SAMEORIGIN"`, custom request header
  `X-Forwarded-Proto: "https"`.
- **`fix-js-mime-types`** (`:17-20`): forces response header
  `Content-Type: application/javascript; charset=utf-8` (fixes mis-served JS
  assets).

`middlewares.yml` is only mounted into Traefik in **prod**
(`docker-compose.prod.yml:24`); the `security-headers` middleware is attached
to backend, frontend, and dashboard routers in prod only.

# Dev dashboard

Dev enables `api.insecure=true` and exposes the dashboard on
`traefik.testing.maurc.org` (`/api`, `/dashboard`) over HTTP
(`docker-compose.dev.yml:20-22`). Prod secures it behind TLS on
`${TRAEFIK_DOMAIN}`.

# `init-db.sql`

A 3-line file (`init-db.sql:1-3`): single statement
`CREATE EXTENSION IF NOT EXISTS vector;` — enables the **pgvector** extension
on database init. Mounted only in **dev** (`docker-compose.dev.yml:37`);
prod relies on the `pgvector/pgvector:pg16` image + Alembic migrations — see
[/backend/database.md](/backend/database.md).
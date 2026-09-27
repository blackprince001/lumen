---
type: Guide
title: Setup & Deployment
description: The ways to run the stack — local instance (no Docker), Docker dev (docker-compose.dev.yml), Docker prod (docker-compose.prod.yml, optionally behind a Cloudflare Tunnel via docker-compose.tunnel.yml) and deploy.sh — with the env, hosts, and migration facts each path needs.
resource: README.md
tags: [infra, setup, deployment, docker, local-dev]
timestamp: 2026-09-27T00:00:00Z
---

There is **no plain `docker-compose.yml`** — only `docker-compose.dev.yml` and
`docker-compose.prod.yml` (topology in [docker.md](/infra/docker.md)). The
user-facing walkthrough lives in the repo `README.md` ("Getting Started" /
"Production Deployment"); this concept records the load-bearing facts each
path depends on.

A fact shared by both Docker paths: the backend image's `CMD` runs
`alembic upgrade head` before starting uvicorn (`backend/Dockerfile:31`), so
**migrations run automatically on container start** — no manual
`exec backend alembic upgrade head` step. Only the local (no-Docker) path runs
migrations by hand.

# Local instance (no Docker)

Backend and frontend run natively with hot reload; Postgres/Redis usually come
from the dev compose services:

```bash
docker compose -f docker-compose.dev.yml up -d postgres redis
```

* **Env loading is cwd-relative**: `Settings` uses pydantic-settings with
  `env_file=".env"` (`app/core/config.py:80-82`), resolved against the
  process working directory — running from `backend/` looks for
  `backend/.env` (which doesn't exist; only a stub `.env.example`), **not**
  the repo-root `.env`. The canonical preamble for every backend terminal
  (API, worker, beat) is therefore:

  ```bash
  cd backend
  set -a; source ../.env; set +a   # load the root .env into the shell
  export DB_HOST=localhost DB_PORT=5433 REDIS_HOST=localhost
  export STORAGE_PATH=./storage/papers   # root .env carries the container path
  export FRONTEND_URL=http://localhost:5173 APP_URL=http://localhost:5173
  export DEBUG=true
  ```

  (OS env vars take precedence over env-file values, so the overrides win.)
* Postgres is mapped to host port **5433** (not 5432) and Redis to 6379 —
  hence `DB_PORT=5433` with the compose Postgres. `init-db.sql` (creates
  the pgvector extension) only runs on first initialization of the volume;
  a native Postgres needs `CREATE EXTENSION vector;` manually.
* **Redis has no password** in either compose file (`redis-server` without
  `--requirepass`) — `REDIS_PASSWORD` must stay empty or AUTH fails with
  "Client sent AUTH, but no password is set".
* Backend: `uv sync`, then `uv run alembic upgrade head` and
  `uv run fastapi dev app/main.py` (localhost:8000).
* Deep-research mutation endpoints are enabled by default. Set
  `DEEP_RESEARCH_MUTATIONS_ENABLED=false` in the shell and
  `VITE_DEEP_RESEARCH_MUTATIONS_ENABLED=false` in `frontend-v2/.env` only for an
  incident or maintenance window.
* Frontend: `bun install`, `.env` with
  `VITE_API_URL=http://localhost:8000/api/v1` + `VITE_GOOGLE_CLIENT_ID`,
  `bun run dev` (localhost:5173).
* Celery is required for ingestion/AI tasks. Use separate terminals with the same
  environment preamble:

  ```bash
  # Terminal 1 — API
  uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

  # Terminal 2 — interactive worker; deliberately excludes research
  uv run celery -A app.celery_app worker -l info -Q ai,processing,discovery,dead_letter -c 2 --hostname=lumen-interactive@%h

  # Terminal 3 — dedicated research worker
  uv run celery -A app.celery_app worker -l info -Q research -c 1 --hostname=lumen-research@%h

  # Terminal 4 — beat scheduler
  uv run celery -A app.celery_app beat -l info
  ```

  The dedicated research worker is intentionally separate so the later queue
  isolation work is observable locally. Beat is optional, but useful for the
  periodic retry sweep.
* **All processes must share the same `JWT_SECRET_KEY` /
  `AI_KEY_ENCRYPTION_KEY`** — the worker decrypts user AI-provider keys the
  API encrypted, so per-terminal `openssl rand` values break decryption.
  The keys are arbitrary secret strings (SHA-256-derived to Fernet keys in
  `app/core/encryption.py`); generate once (`openssl rand -hex 32`), keep in
  the root `.env`.

For a single shell-managed run, keep each process's output in a separate log file
under `.local/logs/` and use `tail -f .local/logs/<process>.log`. The browser targets
`http://localhost:5173`; API health is `http://localhost:8000/health`.

# Docker dev (`docker-compose.dev.yml`)

Full 7-service stack behind Traefik on port 80, HTTP only. Hostnames are
**hardcoded** to `*.testing.maurc.org` (see [docker.md](/infra/docker.md)),
so setup requires:

1. `/etc/hosts`:
   `127.0.0.1 testing.maurc.org api.testing.maurc.org traefik.testing.maurc.org`
2. `.env` (from `.env.example`): keys + JWT/encryption/admin vars, and the dev
   URLs matching those hosts —
   `FRONTEND_URL=http://testing.maurc.org`, `APP_URL=http://testing.maurc.org`,
   `VITE_API_URL=http://api.testing.maurc.org/api/v1`,
   `VITE_GOOGLE_CLIENT_ID`. `DB_USER`/`DB_PASSWORD` default to `postgres`,
   `DEBUG` defaults to `true`.
3. `docker compose -f docker-compose.dev.yml up -d --build`.

Entry points: app `http://testing.maurc.org`, API
`http://api.testing.maurc.org` (`/health`), Traefik dashboard
`http://traefik.testing.maurc.org/dashboard/` (insecure API mode). Postgres
(5433) and Redis (6379) are host-exposed for debugging.

# Docker prod (`docker-compose.prod.yml`)

Same topology plus TLS and hardening (differences enumerated in
[docker.md](/infra/docker.md); middleware in [traefik.md](/infra/traefik.md)):

1. DNS `A` records for `TRAEFIK_DOMAIN`, `BACKEND_DOMAIN`, `FRONTEND_DOMAIN`
   → server IP.
2. `.env`: API keys, `JWT_SECRET_KEY`, `AI_KEY_ENCRYPTION_KEY`, admin creds,
   `DB_USER`/`DB_PASSWORD` (**`DB_PASSWORD` has no default in prod**),
   `LETSENCRYPT_EMAIL`, the three domain vars, and `VITE_GOOGLE_CLIENT_ID`.
   `FRONTEND_URL`/`APP_URL`/`VITE_API_URL` are **derived** from
   `FRONTEND_DOMAIN`/`BACKEND_DOMAIN` inside the compose file — do not set
   them.
3. `mkdir -p backend/storage letsencrypt` — prod bind-mounts
   `./backend/storage:/app/storage` (dev uses the `storage_data` named
   volume) and stores ACME state in `./letsencrypt/acme.json`.
4. `docker compose -f docker-compose.prod.yml up -d --build`; verify
   `https://$BACKEND_DOMAIN/health` and the frontend. First-boot cert
   issuance can take a minute (check the `traefik` service logs).

`middlewares.yml` (security headers) is mounted into Traefik in prod only.

Worker sizing comes from `CELERY_WORKER_REPLICAS` (default 2) and
`CELERY_WORKER_CONCURRENCY` (default 4). A 2-CPU host runs fine at 1 × 2.

# Docker prod behind a Cloudflare Tunnel

`docker-compose.tunnel.yml` layers on top of the prod file. It puts Traefik
behind a compose profile (so it doesn't start) and adds a `lumen-cloudflared`
container on `app-network` that runs with `CLOUDFLARE_TUNNEL_TOKEN`. No host
ports are bound, and there's no ACME or DNS `A` record step. Why:
[/decisions/cloudflare-tunnel-ingress.md](/decisions/cloudflare-tunnel-ingress.md).

1. `.env`: set `CLOUDFLARE_TUNNEL_TOKEN`, and set `FRONTEND_DOMAIN` and
   `BACKEND_DOMAIN` to the **same** hostname. The frontend is then built with
   `VITE_API_URL=https://<host>/api/v1` and CORS is same-origin.
   `LETSENCRYPT_EMAIL`/`TRAEFIK_DOMAIN` are unused.
2. Tunnel public hostnames (remote-managed, in the Cloudflare dashboard), with
   the `/api` rule first: `<host>` path `^/api/` →
   `http://nexus-backend-prod:8000`, then `<host>` →
   `http://nexus-frontend-prod:4173`. This works because every backend route is
   under `/api/v1` and the PWA service worker already denylists `/api/`.
   `/health` is not routed publicly.
3. `./deploy.sh` (see below).

The live deployment is `https://lumen.pkab.work` on the `deployment` SSH host,
checked out at `/root/lumen`.

# deploy.sh

`deploy.sh` at the repo root runs `git pull --ff-only`,
`mkdir -p backend/storage letsencrypt`,
`docker compose ... up -d --build --remove-orphans`, and an image prune. It
then polls the backend `/health` from inside the container for up to 150 s. It
adds `-f docker-compose.tunnel.yml` when `.env` has a non-empty
`CLOUDFLARE_TUNNEL_TOKEN`. With arguments, `./deploy.sh <ssh-host> [dir]` SSHes
in and runs itself on the server (`dir` defaults to `~/lumen`). The body sits in
a `main` function so the pull can rewrite the script mid-run.

# Infrastructure

Docker Compose (7-service topology, dev + prod), Traefik v2 routing/TLS, and
the environment configuration consumed across backend, frontend, and infra.

# Concepts

* [Docker Compose](docker.md) - the 7 services (traefik, postgres, redis, backend, celery-worker x2, celery-beat, frontend), dev vs prod differences, volumes, ports.
* [Traefik](traefik.md) - routing labels, Let's Encrypt, security-headers middleware, fix-js-mime-types, init-db.sql.
* [Environment configuration](env-config.md) - root `.env.example` full variable list + the frontend build-time vars.
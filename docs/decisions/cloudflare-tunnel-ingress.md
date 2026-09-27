---
type: ADR
title: Cloudflare Tunnel as optional prod ingress
description: docker-compose.tunnel.yml replaces Traefik + Let's Encrypt with a Cloudflare Tunnel and serves the API same-origin under /api. The Traefik path stays the default.
resource: docker-compose.tunnel.yml
tags: [adr, infra, deployment, cloudflare, traefik]
timestamp: 2026-09-27T00:00:00Z
---

# Decision

Prod can run behind a Cloudflare Tunnel through an override file,
`docker-compose.tunnel.yml`. It doesn't replace the Traefik setup. With the
override, Traefik is off, a `cloudflared` container joins `app-network`, and
the frontend and API share one hostname. The tunnel routes `^/api/` to the
backend and everything else to the frontend.

# Context

The first real deployment host sits on a LAN (192.168.8.x) behind NAT and is
shared with other apps. Its port 8000 is already in use, and it already runs
other tunnels. Let's Encrypt's HTTP challenge needs inbound port 80, which
that host doesn't offer, and opening ports on a shared box was not wanted.

# Consequences

* TLS ends at Cloudflare. Traffic from the tunnel to the containers is plain
  HTTP on the internal Docker network.
* Traefik's `security-headers@file` middleware no longer applies. Any headers
  we want must now come from Cloudflare or the app.
* The single hostname removes cross-origin API calls. `FRONTEND_URL` and
  `VITE_API_URL` both derive from the one domain.
* Tunnel ingress rules live in the Cloudflare dashboard (remote-managed token),
  not in the repo. The README and [setup](/infra/setup.md) document the two
  rules and their order.
* The backend `/health` is not reachable publicly. `deploy.sh` checks it from
  inside the container.

# Alternatives

* **Keep Traefik, point the tunnel at it.** One tunnel rule and the security
  headers survive, but it runs an extra proxy hop and a container whose TLS
  work is wasted. Rejected for now. Revisit if we need header control in the
  app stack.
* **Two hostnames (`app` and `api`).** Matches the Traefik layout, but it needs
  CORS and a second DNS record. A nested name like `api.lumen.example.com` also
  falls outside Cloudflare's free Universal SSL.

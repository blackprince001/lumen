---
type: ADR
title: AI_KEY_ENCRYPTION_KEY decouples at-rest key encryption from JWT rotation
description: Fernet keying for stored user AI provider keys now prefers a dedicated AI_KEY_ENCRYPTION_KEY, with the JWT-derived key retained as a decrypt-only fallback via MultiFernet.
tags: [adr, backend, security, encryption]
timestamp: 2026-07-01T00:00:00Z
---

# Status

Accepted (2026-07-01, reformation batch 1).

# Context

`encryption.py` derived its Fernet key solely from `JWT_SECRET_KEY`, so
rotating the JWT secret (or restarting without it set — the config
auto-generates one) silently made every stored user AI provider key
undecryptable.

# Decision

A new `AI_KEY_ENCRYPTION_KEY` setting ([/backend/config.md](/backend/config.md))
is the primary Fernet key when set. `MultiFernet` keeps the JWT-derived key
as a decrypt-only fallback: pre-existing ciphertexts remain readable, new
writes always use the primary key. No data migration required; unset, the
legacy behavior is unchanged.

The JWT warn-and-autogenerate behavior outside DEBUG was deliberately kept
(no hard-fail) per owner preference.

# Consequences

- With `AI_KEY_ENCRYPTION_KEY` set, JWT rotation no longer destroys stored
  keys.
- Rotating `AI_KEY_ENCRYPTION_KEY` itself still breaks values encrypted
  under it (only the JWT-derived fallback is retained) — a re-encryption
  sweep would be needed for that.

# Citations

[1] Reformation backend pitfall #9 — [/reformation.md](/reformation.md).
[2] `backend/app/core/encryption.py`, `backend/app/core/config.py`.

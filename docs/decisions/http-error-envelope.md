---
type: ADR
title: Global HTTP error envelope {code, message, detail}
description: All HTTP error responses carry a stable machine-readable code plus a human message, mirroring the SSE structured-error taxonomy, while keeping `detail` for backward compatibility.
tags: [adr, backend, errors, api]
timestamp: 2026-07-01T00:00:00Z
---

# Status

Accepted (2026-07-01, reformation batch 1).

# Context

The chat layer already emits structured error codes over SSE
([structured-ai-errors](/decisions/structured-ai-errors.md)), but plain HTTP
routes returned FastAPI's default `{"detail": "..."}` — no machine-readable
code, and unhandled exceptions leaked default plaintext 500s. The frontend's
`extractErrorMessage` read `data.detail`, so the shape could not simply be
replaced.

# Decision

`app/core/error_handlers.py` registers three global handlers (wired in
[/backend/entry-point.md](/backend/entry-point.md)):

- `HTTPException` → `{code, message, detail}` where `code` derives from the
  status (401→`UNAUTHORIZED`, 429→`RATE_LIMIT`, …) and `detail` == `message`
  for backward compatibility.
- `RequestValidationError` → 422 `VALIDATION_ERROR` plus an `errors` list.
- `Exception` → logged with traceback, generic 500 `INTERNAL_ERROR` (no
  internals leaked).

The frontend `ApiError` gained a `code` field and prefers `message` over
`detail` ([/frontend/api-layer.md](/frontend/api-layer.md)).

# Consequences

- Frontend can branch on `err.code` (typed handling) instead of string
  matching; existing `detail` consumers keep working.
- Caveat: the generic `Exception` handler runs in Starlette's outermost
  `ServerErrorMiddleware`, so 500 responses do not carry CORS headers —
  browsers see them as opaque network errors. Acceptable for now.

# Citations

[1] Reformation backend pitfall #3 — [/reformation.md](/reformation.md).

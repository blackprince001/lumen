---
type: API Collection
title: Intent Route API
description: Home-omnibox intent routing — one Jev Choice maps a request to a destination with a route/suggest/fallback action.
resource: backend/app/api/route.py
tags: [backend, api, routing, intent, jev]
timestamp: 2026-09-17T00:00:00Z
---

Single router mounted at `/api/v1/route` (tag `route`, auth required).

# `route.py`

| Method | Path | Notes |
|---|---|---|
| POST | `/route` | `{query}` (1–500 chars) → `{destination, action, confidence, probabilities, model, fallback, context}` |

Destinations: `library_search`, `discovery_search`, `ai_search`,
`deep_research`, `unsupported`. Actions: `route` (confidence ≥ 0.8,
auto-navigate), `suggest` (mid confidence — frontend shows destination
chips, ordered by probability), `fallback` (low confidence, unsupported,
or gate off — reproduces today's library search with `fallback: true`).
Deep research is suggested at most, never auto-started.

The endpoint attaches a small `context.library` hint (total papers, title
matches, top-3 matching titles — millisecond COUNT/LIMIT queries, no
embeddings) so the judgment is grounded in the user's collection instead
of guessing about it. With empty context the criteria fall back to request
shape alone.

Judgment lives in `services/judgments.py` (`route_query`, `route_action`
policy); the endpoint is a thin fail-soft wrapper. Frontend entry is the
Home hero omnibox — see the home search flow in the frontend bundle.

---
type: Feature Plan
title: Deep Research
description: Multi-step, source-backed research sessions driven by an agent against an external MCP server, with a per-user daily cap and a per-deployment feature flag.
tags: [feature-plan, deep-research, agent, mcp]
timestamp: 2026-06-28T00:00:00Z
---

A forward-looking plan for a "deep research" feature: long-running, multi-step
research sessions that ground responses in real web/academic sources, executed
by an agent against an external Model Context Protocol (MCP) server. This is
**not yet implemented** — it is gated behind a feature flag and tracked here as
the canonical feature-plan concept referenced by the
[reformation assessment](/reformation.md).

# Status

Planned / not implemented. The deployment-side knobs already exist in the env
(see [Configuration](#configuration) below) but no `Settings` fields, routes,
services, or tasks implement the feature yet.

# Motivation

Today the discovery agent ([/backend/services/ai-agent.md](/backend/services/ai-agent.md))
fires one-shot searches across arXiv / Semantic Scholar / OpenAlex / Google
Scholar with a bounded turn budget (`AGENT_MAX_TURNS=25`). "Deep research"
extends that into a longer-running, source-cited, multi-step investigation —
the kind of query where the answer requires chaining several searches and
reading partial results — without occupying a regular chat worker slot for
minutes.

# Configuration

Both variables below are declared in the root `.env.example` (see
[/infra/env-config.md](/infra/env-config.md)), passed through by
docker-compose, and modeled as `Settings` fields in
`backend/app/core/config.py`.

| Variable | Default | Purpose |
|---|---|---|
| `ENABLE_DEEP_RESEARCH` | `false` | Feature flag (off by default) |

> **Revised 2026-07-01**: `DEEP_RESEARCH_DAILY_CAP`, `DEEP_RESEARCH_MODEL`,
> `DEEP_RESEARCH_MCP_URL`, and `DEEP_RESEARCH_MCP_TOKEN` were removed from
> `.env.example`, compose, and `Settings` — the agent approach will not
> depend on an external MCP server, a deployment-level model override, or a
> daily cap. Only the `ENABLE_DEEP_RESEARCH` flag remains. The architecture
> below still reflects the old MCP-based sketch and needs revision when this
> feature is taken up.

# Proposed architecture

Reuses existing infrastructure rather than introducing a new stack:

- **Agent**: extend the openai-agents SDK orchestration in
  [`services/ai/agent/`](/backend/services/ai-agent.md) with a new `deep_research`
  agent whose tool set is the MCP server at `DEEP_RESEARCH_MCP_URL` (the SDK
  supports MCP servers as tool providers). Gated on `ENABLE_DEEP_RESEARCH`.
- **Execution**: long-running, so it runs as a **Celery task** on the `ai`
  queue (not in-request). Streaming UI progress over Redis pub/sub, mirroring
  the `search_source_task` progress pattern already used by discovery tasks
  ([/backend/tasks.md](/backend/tasks.md)).
- **Per-user daily cap**: Redis token bucket keyed by `user_id`, decremented on
  task dispatch. Returns 429 (or a structured `ERROR_CODE_RATE_LIMIT` over SSE
  — see [/decisions/structured-ai-errors.md](/decisions/structured-ai-errors.md))
  when `DEEP_RESEARCH_DAILY_CAP` is exhausted. Replaces the global Celery
  `10/m` rate limit for this path — see the [reformation assessment](/reformation.md#backend-pitfalls--improvements),
  item 6.
- **Provider**: honor the user's BYO provider for generation
  ([/decisions/byo-ai-providers.md](/decisions/byo-ai-providers.md)) but use the
  deployment-configured `DEEP_RESEARCH_MCP_URL` for tools (the MCP server is
  infrastructure, not a model provider). If `DEEP_RESEARCH_MODEL` is set it
  overrides the user's chat model for these runs — explicit because deep
  research needs a long-context, tool-capable model and a user's default may
  not qualify.
- **Persistence**: add a `DeepResearchSession` model (sibling to
  `DiscoverySession` — see [/backend/models.md](/backend/models.md)) with the
  question, the final answer, and the ordered list of cited sources; surface
  under `/discovery` in the frontend and on a `/deep-research` route. Add a
  migration ([/backend/database.md](/backend/database.md) — current Alembic
  head is `citation_map_001`).
- **Error handling**: reuse the agent error taxonomy
  ([/decisions/structured-ai-errors.md](/decisions/structured-ai-errors.md))
  and add `ERROR_CODE_RESEARCH_CAP_EXHAUSTED` for the daily-cap case.

# Open questions

- Does deep research stream answers to the user as they are produced (SSE, like
  chat) or surface a single completed artifact when the task finishes (like
  discovery's `search_source_task`)? Likely the former for engagement — there
  is already a `stream_db_session()` pattern ([/decisions/stream-db-session.md](/decisions/stream-db-session.md))
  to lean on.
- Granularity of the daily cap: per session initiation, or per research "turn"?
- Should deep-research results be addable to the library in one click (reuse
  the `discovery/add-to-library` batch endpoint — see [/backend/api/discovery.md](/backend/api/discovery.md))?
- Should the MCP server URL/token be per-user-overridable (BYO MCP) or strictly
  deployment-configured? Current env design says deployment-only; the
  per-user BYO story for AI providers ([/decisions/byo-ai-providers.md](/decisions/byo-ai-providers.md))
  does not currently cover MCP servers.

# Implementation checklist (TBD)

- [ ] Model `DEEP_RESEARCH_*` env vars as `Settings` fields (gated on `ENABLE_DEEP_RESEARCH`).
- [ ] Add `DeepResearchSession` model + migration.
- [ ] Add `deep_research` agent + MCP tool set under `services/ai/agent/`.
- [ ] Add Celery task `deep_research.run_task` (queue `ai`), per-user daily cap in Redis.
- [ ] Add `/api/v1/deep-research` routes (start, stream, list, get, delete) — likely a new router grouped with discovery.
- [ ] Add frontend route + page; reuse `useAISearchStream` shape (see [/frontend/chat-system.md](/frontend/chat-system.md)).
- [ ] ADR: "Per-user daily cap via Redis token bucket" — once the pattern is settled, add to [/decisions/](/decisions/index.md).

# Citations

[1] `.env.example` — `ENABLE_DEEP_RESEARCH`, `DEEP_RESEARCH_DAILY_CAP`, `DEEP_RESEARCH_MODEL`, `DEEP_RESEARCH_MCP_URL`, `DEEP_RESEARCH_MCP_TOKEN`.
[2] [/infra/env-config.md](/infra/env-config.md) — current documentation of those vars.
[3] [/backend/services/ai-agent.md](/backend/services/ai-agent.md) — where the agent would live.
[4] [/reformation.md](/reformation.md) — the assessment that tracks this feature and its prerequisites.
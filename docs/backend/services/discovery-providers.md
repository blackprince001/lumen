---
type: Module
title: Discovery Providers
description: Academic source providers (arXiv, Semantic Scholar, OpenAlex, Google Scholar via SerpAPI) plus multi-source search orchestration and AI-enhanced search.
resource: backend/app/services/discovery
tags: [backend, discovery, providers, arxiv, semantic-scholar, openalex, serpapi]
timestamp: 2026-06-28T00:00:00Z
---

`backend/app/services/discovery/` contains academic source providers, each
behind the `BaseDiscoveryProvider` ABC (`base_provider.py`) with a shared
`httpx.AsyncClient`.

# Providers

| File | Source | Endpoint / client | Key |
|---|---|---|---|
| `arxiv_provider.py` | arXiv + SearchTheArxiv | `https://export.arxiv.org/api` + `https://searchthearxiv.com` | — |
| `semantic_scholar_provider.py` | Semantic Scholar | `https://api.semanticscholar.org/graph/v1` (incl. recommendations) | `SEMANTIC_SCHOLAR_API_KEY` (optional) |
| `openalex_provider.py` | OpenAlex | `https://api.openalex.org` | none required |
| `google_scholar_provider.py` | Google Scholar | via **SerpAPI** (`serpapi.GoogleSearch`) | `settings.SERPAPI_KEY` |

# Orchestration

- `discovery_service.py` — orchestrates multi-source search; registers the
  Google Scholar provider only when `SERPAPI_KEY` is set (`discovery_service.py:498`).
  exposed on the discovery router — see [/backend/api/discovery.md](/backend/api/discovery.md).
- `ai_search_service.py` — AI-enhanced search using the user's configured
  provider; powers `/discovery/ai-search` and the `/ai-search/stream` SSE
  endpoint.
- `provider_registry.py` — `provider_registry` singleton for discovery
  providers.

# Related

Per-source search runs as the `search_source_task` Celery task (progress
pushed over Redis); AI enhancement runs as `ai_enhance_task` — see
[tasks.md](/backend/tasks.md). The semantic-scholar service singleton
(`services/semantic_scholar.py`) is also reused by the citation-map service
for citation neighbors — see [services-catalog.md](/backend/services/services-catalog.md).
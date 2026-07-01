---
type: Reference
title: Other Services Catalog
description: Every backend service not covered by the AI-agent or discovery concepts — ingestion, citations, search, storage, embeddings, email, export, figures, layout, and the Semantic Scholar singleton.
tags: [backend, services, catalog]
timestamp: 2026-06-28T00:00:00Z
---

Top-level services in `backend/app/services/` (the AI agent and discovery
subtrees are in [ai-agent.md](/backend/services/ai-agent.md) and
[discovery-providers.md](/backend/services/discovery-providers.md)).

# Ingestion & PDF processing

| File | Purpose |
|---|---|
| `ingestion.py` | Paper ingest pipeline; fetches URLs via `httpx.AsyncClient` |
| `url_parser.py` | Parses paper source URLs (arXiv/DOI/etc.) into structured data |
| `pdf_parser.py` | PDF text extraction (`pypdf`) |
| `layout_extractor.py` | PyMuPDF-based per-page text/figure block extraction |
| `figure_service.py` | Renders PDF figure regions to PNG for vision-capable model analysis |
| `storage.py` | Filesystem storage under `settings.STORAGE_PATH` (content-hash filenames) |
| `content_provider.py` | Resolves paper files, uploads to AI providers (Gemini file uploads), builds content parts |

# Citations & relationships

| File | Purpose |
|---|---|
| `citation_extractor.py` | Extracts inline citations from PDF reference sections |
| `citation_map_service.py` | Builds citation-map graph data; integrates **Semantic Scholar** for citation neighbors |
| `graph_service.py` | Citation-graph aggregation |
| `references.py` | Reference parsing utilities |
| `reference_resolver.py` | Resolves inline `ref:<kind>/<id>` tokens into structured preview manifests |

# Search & embeddings

| File | Purpose |
|---|---|
| `search_service.py` | Full-text + annotation search via SQLAlchemy |
| `embeddings.py` | **Google-only** embedding service (`GOOGLE_API_KEY`, `gemini-embedding-001`, 768-dim) — NOT BYO |

# Chat orchestration

| File | Purpose |
|---|---|
| `chat.py` | Single-paper chat orchestration via the agents SDK; falls back to legacy `provider.generate()` |
| `multi_chat.py` | Multi-paper/group chat orchestration (same SDK-first + legacy fallback pattern) |
| `base_ai_service.py` | Legacy shim re-exporting `app.services.ai.base_ai_service.BaseAIService` |

# Misc

| File | Purpose |
|---|---|
| `duplicate_detection.py` | Fuzzy duplicate detection via `SequenceMatcher` |
| `email_service.py` | Transactional email via **Resend** SDK (`import resend`) |
| `export_service.py` | CSV / JSON / BibTeX export apa/mla/bibtex/chicago/ieee |
| `huggingface_service.py` | Fetches **HuggingFace Daily Papers** via `httpx` |
| `reading_tracker.py` | Reading-time / streak statistics aggregation |
| `semantic_scholar.py` | **Semantic Scholar API** client singleton (`semantic_scholar_service`); used by discovery + citation-map |
| `task_status.py` | Pydantic `TaskStatus` model + status enum for Celery results |
| `url_parser.py` | (listed above) |
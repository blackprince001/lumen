# Implementation

## Entry Points
- `backend/main.py` — Uvicorn launcher; imports `app` from `app/main.py`
- `backend/app/main.py` — FastAPI app factory; registers all routers under `/api/v1`, mounts `/storage` static directory, runs `init_db()` on lifespan startup
- `backend/app/celery_app.py` — Celery app instance; workers process tasks from `app/tasks/`
- `frontend/src/main.tsx` — React entrypoint; mounts `<RouterProvider router={router} />`
- `frontend/src/router.tsx` — React Router browser router; all 14 routes defined here under `Layout`
- `extension/src/popup.ts` / `options.ts` — Browser extension entry points

## Per-Module Breakdown

### API Layer (`backend/app/api/`)
- **Entry point:** `app/main.py` includes all routers
- **Key routers:** `ingest`, `papers`, `chat`, `multi_chat`, `discovery`, `search`, `annotations`, `groups`, `tags`, `export`, `duplicates`, `ai_features`, `relationships`, `statistics`, `tasks`, `huggingface`
- **Non-obvious:** All routes are prefixed `/api/v1`; discovery routes additionally prefixed `/api/v1/discovery`; tasks routes prefixed `/api/v1/tasks`

### Discovery Service (`backend/app/services/discovery/`)
- **Key files:** `discovery_service.py` (orchestrator), `arxiv_provider.py`, `semantic_scholar_provider.py`, `google_scholar_provider.py`, `ai_search_service.py`, `base_provider.py`, `provider_registry.py`
- **Non-obvious:** Queries run in parallel across providers; arXiv uses SearchTheArxiv for semantic search + official API as fallback; providers are registered in `provider_registry.py`; query understanding/routing added in recent commits

### Services (`backend/app/services/`)
- `ingestion.py` — Full ingestion pipeline: URL/PDF → parse → embed → store
- `embeddings.py` — Wraps Google Gemini embedding API; dimension 768
- `pdf_parser.py` — PDF text extraction via pypdf
- `chat.py` / `multi_chat.py` — SSE streaming chat with paper context using Gemini
- `semantic_scholar.py` — Semantic Scholar API client with API key + rate limiting
- `duplicate_detection.py` — Detects duplicate papers
- `search_service.py` — Combines vector and full-text search
- `export_service.py` — Export papers to various formats
- `graph_service.py` — Citation graph computation
- `storage.py` — File storage for PDFs

### Tasks (`backend/app/tasks/`)
- `paper_processing.py` — Main ingestion Celery task
- `ai_tasks.py` — AI summarization, key findings extraction
- `search_tasks.py` — Background search operations
- `base.py` — Base Celery task class

### Models (`backend/app/models/`)
Key models: `Paper`, `Annotation`, `Group`, `Tag`, `Chat`, `MultiChat`, `Bookmark`, `ReadingSession`, `SavedSearch`, `DuplicateLog`, `PaperCitation`, `Discovery`

### Frontend Pages (`frontend/src/pages/`)
| Page | Route |
|---|---|
| `PapersList` | `/` |
| `PaperDetail` | `/papers/:id` |
| `Search` | `/search` |
| `Groups` / `GroupDetail` | `/groups`, `/groups/:id` |
| `AllAnnotations` | `/annotations` |
| `Dashboard` | `/dashboard` |
| `PaperCitations` | `/citations` |
| `IngestPaper` | `/ingest` |
| `ExportPapers` | `/export` |
| `Discovery` | `/discovery` |
| `DiscoveryArchive` | `/discovery-archive` |
| `Recommendations` | `/recommendations` |
| `HuggingFacePapers` | `/huggingface-papers` |

### Frontend API Layer (`frontend/src/lib/api/`)
- `client.ts` — Axios/fetch base client
- Per-domain modules: `papers.ts`, `chat.ts`, `multi-chat.ts`, `discovery.ts`, `search.ts`, `annotations.ts`, `groups.ts`, `tags.ts`, `export.ts`, `duplicates.ts`, `aiFeatures.ts`, `statistics.ts`, `huggingface.ts`

## Configuration
| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | constructed from DB_* | PostgreSQL async connection string |
| `STORAGE_PATH` | `./storage/papers` | PDF file storage directory |
| `EMBEDDING_MODEL` | `gemini-embedding-001` | Google Gemini embedding model |
| `EMBEDDING_DIMENSION` | `768` | Vector dimension for pgvector |
| `GOOGLE_API_KEY` | `""` | Google Gemini API key |
| `SERPAPI_KEY` | `""` | SerpAPI key for Google Scholar |
| `SEMANTIC_SCHOLAR_API_KEY` | `""` | Semantic Scholar API key |
| `GENAI_MODEL` | `gemini-3-flash-preview` | Gemini model for chat/AI features |
| `REDIS_HOST/PORT/DB` | `localhost/6379/0` | Redis for Celery broker + result backend |
| `DEBUG` | `false` | Debug mode |

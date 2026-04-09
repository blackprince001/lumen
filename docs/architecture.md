# Architecture

## Project Type
Polyglot monorepo — Python 3.13 FastAPI backend + React/TypeScript frontend + TypeScript browser extension.
App name: **Nexus Research Engine**.

## Directory Map
```
papers/
├── backend/               # FastAPI + Celery + SQLAlchemy async (Python 3.13)
│   ├── app/
│   │   ├── api/           # Route handlers (one file per domain)
│   │   ├── core/          # config.py, database.py, logger.py
│   │   ├── models/        # SQLAlchemy ORM models
│   │   ├── schemas/       # Pydantic request/response schemas
│   │   ├── services/      # Business logic (incl. discovery/ sub-package)
│   │   ├── tasks/         # Celery tasks (paper_processing, ai_tasks, search_tasks)
│   │   └── utils/         # citation_extractor, json_extractor, text
│   ├── migrations/        # Alembic migrations
│   └── main.py            # Uvicorn entrypoint (imports app from app/main.py)
├── frontend/              # React 18 + Vite + TypeScript + TanStack Query
│   └── src/
│       ├── components/    # ~55 reusable components
│       ├── pages/         # 14 route-level pages
│       ├── hooks/         # Custom React hooks
│       ├── lib/api/       # Per-domain API client modules
│       ├── lib/ai/        # AI streaming helpers
│       └── store/         # State management
├── extension/             # Browser extension (TypeScript + Vite)
│   └── src/               # popup.ts, options.ts for capturing paper URLs
├── docker-compose.yml     # Dev compose (postgres, redis, backend, frontend)
├── docker-compose.prod.yml
└── init-db.sql            # DB initialization
```

## Module Overview
| Module/Package | Purpose |
|---|---|
| `backend/app/api/` | REST endpoints — one file per domain (papers, ingest, chat, discovery, etc.) |
| `backend/app/services/discovery/` | Multi-source paper discovery: arXiv, Semantic Scholar, Google Scholar, AI search |
| `backend/app/services/` | Core business logic — ingestion, embeddings, chat, PDF parsing, export |
| `backend/app/tasks/` | Celery async tasks for paper processing, AI, and search |
| `backend/app/models/` | SQLAlchemy ORM models (Paper, Annotation, Group, Chat, MultiChat, Tag, etc.) |
| `frontend/src/pages/` | Route pages: PapersList, PaperDetail, Discovery, Search, Dashboard, GroupDetail, etc. |
| `frontend/src/lib/api/` | Typed API client modules per domain (papers, chat, discovery, etc.) |
| `extension/` | Browser extension for capturing paper URLs to ingest |

## Data Flow
1. **Ingest:** User submits URL/PDF → `POST /api/v1/ingest` → Celery task queued → PDF parsed, metadata extracted, embeddings generated via Google Gemini → stored in PostgreSQL + pgvector
2. **Search:** Query → `/api/v1/search` → vector similarity via pgvector or full-text search
3. **Discovery:** User triggers discovery → orchestrator sends parallel queries to arXiv (SearchTheArxiv + official API), Semantic Scholar, Google Scholar → results aggregated and ranked
4. **Chat:** SSE streaming responses from `/api/v1/chat` using Gemini AI with paper context
5. **Frontend:** React + TanStack Query for data fetching, React Router v6 for navigation

## External Dependencies
| Name | Purpose |
|---|---|
| `google-genai` | Gemini embeddings (`gemini-embedding-001`) and AI generation (`gemini-3-flash-preview`) |
| `pgvector` | Vector similarity search in PostgreSQL |
| `celery[redis]` | Background task queue for paper processing |
| `sqlalchemy[asyncio]` + `asyncpg` | Async database ORM |
| `alembic` | Database migrations |
| `pypdf` | PDF text extraction |
| `google-search-results` | SerpAPI for Google Scholar search |
| `httpx` | Async HTTP client (arXiv, Semantic Scholar, HuggingFace APIs) |
| `@tanstack/react-query` | Frontend data fetching and caching |
| `@tiptap/*` | Rich text editor for notes/annotations |
| `react-router-dom` | Frontend client-side routing |

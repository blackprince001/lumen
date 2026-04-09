# Patterns

## Naming Conventions
- Files: `snake_case.py` (backend), `PascalCase.tsx` for components, `kebab-case.ts` for hooks and API modules
- Classes/types: `PascalCase` (Python + TypeScript)
- Functions/methods: `snake_case` (Python), `camelCase` (TypeScript)
- Variables: `snake_case` (Python), `camelCase` (TypeScript)
- API route files: singular noun (e.g., `chat.py`, `paper.py`)

## Folder Conventions
- `backend/app/api/` — thin route handlers only; business logic goes in `services/`
- `backend/app/schemas/` — Pydantic request/response models (separate from ORM models)
- `backend/app/models/` — SQLAlchemy ORM models only
- `backend/app/services/` — all business logic; `discovery/` is a sub-package with its own registry pattern
- `frontend/src/components/` — reusable UI components
- `frontend/src/pages/` — route-level components (one per route)
- `frontend/src/lib/api/` — per-domain typed API client modules
- `frontend/src/hooks/` — custom React hooks (prefixed `use-`)

## Recurring Code Patterns
- **Error handling (backend):** FastAPI HTTPException for API errors; structlog for structured logging via `app/core/logger.py`
- **Async:** Python `async/await` throughout backend (FastAPI + asyncpg + SQLAlchemy async); React hooks with TanStack Query on frontend
- **Dependency injection:** FastAPI `Depends()` for DB session injection; `app/dependencies.py` provides shared deps
- **Validation:** Pydantic schemas for all request/response validation; `pydantic-settings` for config
- **Background tasks:** Celery tasks in `app/tasks/` — triggered from API handlers, results tracked via `task_status.py`
- **Streaming:** Chat endpoints use SSE (Server-Sent Events) for streaming AI responses
- **Discovery providers:** Provider pattern with `base_provider.py` base class; registered in `provider_registry.py`; parallel execution in `discovery_service.py`

## Testing Conventions
- Test runner: `pytest` with `pytest-asyncio`
- Test location: not determinable from scan (no `tests/` directory found at top level — may be absent or undiscovered)
- No observed test helpers or fixtures found in scan

## Anti-Patterns Observed
- `CORS allow_origins=["*"]` in `app/main.py` — open in dev, should be restricted in production
- Ruff 2-space indent (`indent-width = 2`) — non-standard Python indentation, intentional project style choice

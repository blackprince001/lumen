---
type: Reference
title: Backend Tests
description: Test layout and coverage — 10 files focused on the AI agent layer; no HTTP/DB integration tests currently present.
resource: backend/tests
tags: [backend, tests, pytest]
timestamp: 2026-06-28T00:00:00Z
---

`backend/tests/` is flat (no subdirectories beyond `__pycache__`).

```
backend/tests/
├── conftest.py
├── test_agents.py
├── test_citation_map.py
├── test_context.py
├── test_multi_provider.py
├── test_provider_flow.py
├── test_references.py
├── test_run_config.py
├── test_stream_adapter.py
└── test_tools.py
```

# Coverage gap (as of scan)

All 10 files target the **AI agent layer** (agents, providers, multi-provider
routing, streaming, run config, BYO context, function tools, reference
resolution, citation map). There are **no** HTTP/route-level or DB-integration
tests in this directory.

# Tooling

- `pytest` + `pytest-asyncio` (dev group in `pyproject.toml`).
- `pyright` (typecheck) and `ruff` (lint) are the dev toolchain.
- Run backend tests: `uv run pytest` from `backend/`.
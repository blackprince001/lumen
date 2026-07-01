---
type: Module
title: Utils
description: Stateless helpers — text/metadata sanitization, robust JSON extraction from LLM output, and Google grounding citation insertion.
resource: backend/app/utils
tags: [backend, utils, helpers]
timestamp: 2026-06-28T00:00:00Z
---

`backend/app/utils/` holds small pure helpers with no IO or DB access.

- **Text/metadata sanitization** — clean paper titles, author names, and
  other metadata pulled from external sources.
- **Robust JSON extraction** — extract well-formed JSON from LLM responses
  that may wrap JSON in prose/fences or include trailing text.
- **Citation extraction** — insert Google grounding citations into agent
  output and parse inline citation markers.

Reach for these before writing a new parser inline in a service or task.
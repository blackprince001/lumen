---
type: API Collection
title: Chat API
description: Single-paper chat and multi-paper/group chat, both with SSE streaming and threaded follow-up messages.
resource: backend/app/api/chat.py
tags: [backend, api, chat, sse, streaming]
timestamp: 2026-06-28T00:00:00Z
---

Two routers under prefix `/api/v1`: `chat.py` (tag `chat`, single-paper) and
`multi_chat.py` (tag `multi-chat`, group/multi-paper). Streaming endpoints
return `StreamingResponse` with `media_type="text/event-stream"` and use
`stream_db_session()` — see [database.md](/backend/database.md).

# `chat.py`

### Sessions

| Method | Path | Line |
|---|---|---|
| POST | `/papers/{paper_id}/sessions` | `:282` |
| GET | `/papers/{paper_id}/sessions` | `:307` |
| GET | `/sessions/{session_id}` | `:319` |
| PATCH | `/sessions/{session_id}` | `:331` |
| DELETE | `/sessions/{session_id}` | `:350` |
| DELETE | `/sessions/{session_id}/messages` | `:365` |

### Messages — single-paper

| Method | Path | Line | Notes |
|---|---|---|---|
| POST | `/papers/{paper_id}/chat` | `:46` | non-stream send |
| GET | `/papers/{paper_id}/chat` | `:83` | history |
| POST | `/papers/{paper_id}/chat/stream` | `:107` | **SSE** |
| DELETE | `/papers/{paper_id}/chat` | `:152` | clear conversation |

### Threads — follow-up messages

| Method | Path | Line |
|---|---|---|
| GET | `/messages/{message_id}/thread` | `:190` |
| POST | `/messages/{message_id}/thread` | `:203` |
| POST | `/messages/{message_id}/thread/stream` | `:238` | **SSE** |

### Reference resolution

POST `/chat/references/resolve` (`:384`) — turns inline `ref:` tokens into
structured preview manifests.

# `multi_chat.py`

| Method | Path | Line | Notes |
|---|---|---|---|
| POST | `/groups/{group_id}/chat/stream` | `:72` | **SSE** group chat |
| GET | `/groups/{group_id}/chat` | `:118` | group chat history |
| GET / POST | `/groups/{group_id}/multi-sessions` | `:133 / :148` | list / create |
| POST | `/multi-chat/stream` | `:189` | **SSE** (session-scoped, not group-scoped) |
| GET | `/multi-chat/sessions/{session_id}` | `:238` | |
| PATCH / DELETE | `/multi-chat/sessions/{session_id}` | `:254 / :276` | |
| DELETE | `/multi-chat/sessions/{session_id}/messages` | `:286` | clear |

# Orchestration

Both are orchestrated by the openai-agents SDK via
`MultiProviderBuilder`, falling back to legacy `provider.generate()` when the
SDK is absent — see [ai-agent.md](/backend/services/ai-agent.md). The frontend
side of the streaming protocol is in [/frontend/chat-system.md](/frontend/chat-system.md).
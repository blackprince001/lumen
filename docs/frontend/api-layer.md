---
type: Module
title: Frontend API Layer
description: The fetchApi REST client with JWT injection and silent refresh on 401, 20 per-domain *Api modules, and the separate SSE streaming layer.
resource: frontend-v2/src/lib/api/client.ts
tags: [frontend, api, client, auth, sse]
timestamp: 2026-06-28T00:00:00Z
---

`frontend-v2/src/lib/api/`. Barrel at `index.ts` re-exports every `*Api` + types.

# REST client — `lib/api/client.ts`

- Base URL: `import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'` (`client.ts:3`).
- Core `fetchApi<T>(endpoint, options, _isRetry)` (`client.ts:81-166`): builds URL + query `params`, serializes JSON or passes `FormData`, returns `json` | `blob` | `undefined`.
- Convenience `api` object: `get/post/put/patch/delete` (`client.ts:168-183`).
- `credentials: 'include'` is always sent (`client.ts:122`) so the **httpOnly refresh cookie** rides along.

# JWT attachment

A module-level `tokenGetter` callback (`client.ts:24`) is injected by
`AuthContext` via `setTokenGetter`. On every request, if a token exists,
`Authorization: Bearer <token>` is set (`client.ts:112-115`). `getAuthHeaders()`
(`client.ts:31-34`) exposes auth headers for raw `fetch`/`XMLHttpRequest`
paths that bypass the client (used by `papers.ts:340` ingest-from-text and
`papers.ts:240` upload-with-progress).

# Silent refresh & 401 handling (`client.ts:50-79`, `:131-148`)

- `attemptSilentRefresh()` POSTs `/auth/refresh` with credentials (`client.ts:53-70`); guarded by an `isRefreshing` flag to prevent concurrent loops.
- On a 401 (first attempt only), the client tries a silent refresh and replays the original request once with the new token (`client.ts:139-144`).
- Auth-bootstrap endpoints (`/auth/refresh`, `/auth/me`, `/auth/logout`, `/auth/google`, `/auth/admin/login`) are excluded from refresh/redirect logic (`client.ts:75-79`) to avoid login-page redirect loops.
- Custom `ApiError` carries `status` + `data` + `code` — the stable
  machine-readable code from the backend's
  [HTTP error envelope](/decisions/http-error-envelope.md); `extractError`
  prefers `message` over `detail`.

# API modules (`export const xxxApi = {}`)

`authApi`, `papersApi`, `annotationsApi`, `chatApi`, `multiChatApi`,
`searchApi`, `groupsApi`, `tagsApi`, `aiFeaturesApi`, `exportApi`,
`paperSharingApi`, `groupSharingApi`, `statisticsApi`, `huggingfaceApi`,
`citationMapApi`, `referencesApi`, `discoveryApi`, `userAiSettingsApi`,
`userAiProvidersApi`, `usersApi`.

Mirror the backend routers — see [/backend/api/index.md](/backend/api/index.md).

# Streaming layer — `lib/ai/` (separate from REST)

Chat/discovery use SSE so they bypass the REST client:

- `chatStream.ts:132-231` — `chatStreamClient` async generators: `streamMessage` (`/papers/:id/chat/stream`), `streamThreadMessage`, `streamGroupMessage`, `streamMultiMessage`. Each does its own 401→refresh→retry (`chatStream.ts:75-126`), attaching `getAuthHeaders()` and an optional `provider_id` pin.
- `parseSSE.ts:1-207` — raw SSE parser over a `Response` body with timeout (`DEFAULT_TIMEOUT_MS = 60_000`) and retry/backoff.

See [chat-system.md](chat-system.md) for the hooks that consume these.
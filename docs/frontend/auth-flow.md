---
type: Reference
title: Frontend Auth Flow
description: Google OAuth + JWT access token in localStorage + httpOnly refresh cookie, proactive silent refresh before expiry, bootstrap-from-cookie on mount, and route protection.
resource: frontend-v2/src/contexts/AuthContext.tsx
tags: [frontend, auth, oauth, jwt, refresh]
timestamp: 2026-06-28T00:00:00Z
---

Files: `src/contexts/AuthContext.tsx`, `src/lib/api/authApi.ts`,
`src/components/ProtectedRoute.tsx`, `src/pages/Login.tsx`,
`src/pages/AdminLogin.tsx`. Server side: [/backend/security.md](/backend/security.md).

# Google OAuth + JWT, with httpOnly-cookie refresh

1. `GoogleOAuthProvider` wraps the app with `clientId = VITE_GOOGLE_CLIENT_ID` (`main.tsx:26`).
2. `Login.tsx:50-64` renders `<GoogleLogin>` (one-tap off, pill shape). On success it receives a Google **ID token** (`credentialResponse.credential`) and calls `loginWithGoogle(credential)` (`Login.tsx:16-27`).
3. `AuthContext.loginWithGoogle` (`AuthContext.tsx:118-121`) → `authApi.googleLogin(idToken)` POSTs `/auth/google` with `{ id_token }` (`authApi.ts:38-39`). Backend returns `{ access_token, expires_in, user }`.
4. `setAuth` (`AuthContext.tsx:64-69`) saves the session to `localStorage` key `auth_session` (`{token, user, expiresAt}`, `AuthContext.tsx:14-17`), sets state, calls `setTokenGetter(() => token)` so the API client injects the Bearer header (`AuthContext.tsx:67`), and schedules a refresh `expiresIn - 60s` before expiry (`scheduleRefresh`, `AuthContext.tsx:71-84`).
5. Admin path: `loginAsAdmin` → `authApi.adminLogin(username, password)` → `/auth/admin/login` (`authApi.ts:41-42`, `AuthContext.tsx:123-126`).

# Token storage

- Access JWT in `localStorage` (so the client can read and attach it).
- Refresh token in an **httpOnly cookie** (sent via `credentials:'include'`; never touched by JS).
- `authApi.refresh`/`logout` use raw `fetchApi` with `credentials:'include'` (`authApi.ts:44-48`).

# Bootstrap / restore (`AuthContext.tsx:94-116`)

On mount, first try `loadSession()` from localStorage (rejected if < 60s left,
`:24-26`); if none, attempt `/auth/refresh` against the cookie; on failure
`clearAuth()`.

# Silent refresh

Scheduled proactively before expiry (`AuthContext.tsx:74-83`) and reactively
on any 401 inside `fetchApi` (`client.ts:131-148`) and inside the streaming
client (`chatStream.ts:92-118`). See [api-layer.md](api-layer.md) and
[chat-system.md](chat-system.md).

# Route protection

`ProtectedRoute.tsx:10-24` — spinner while `isLoading`; redirect to `/login`
if unauthenticated; redirect to `/` if `requireAdmin` and not admin. Applied
to the whole app shell (`router.tsx:38`) and re-applied with `requireAdmin` on
`/admin/users` (`router.tsx:74`). See [routing.md](routing.md).
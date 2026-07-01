---
type: Module
title: Frontend Entry Point
description: The bootstrap chain in src/main.tsx — StrictMode, ThemeProvider, GoogleOAuthProvider, QueryClientProvider, AuthProvider, TabProvider, RouterProvider, AppToaster. There is no App.tsx.
resource: frontend-v2/src/main.tsx
tags: [frontend, entry-point, bootstrap]
timestamp: 2026-06-28T00:00:00Z
---

`frontend-v2/src/main.tsx` is the bootstrap. There is **no standalone
`App.tsx`** — `router.tsx` is the top-level App and `Layout` is the protected
root route element.

# Provider stack (outermost → innermost)

1. `StrictMode` (`main.tsx:24`)
2. `ThemeProvider` (`main.tsx:25`, from `src/lib/theme.tsx:15`) — light/dark, persisted to `localStorage` key `papers-theme`, defaults to OS `prefers-color-scheme` (`theme.tsx:16-21`)
3. `GoogleOAuthProvider` (`main.tsx:26`, `@react-oauth/google`) — clientId from `import.meta.env.VITE_GOOGLE_CLIENT_ID`
4. `QueryClientProvider` (`main.tsx:27`) — `QueryClient` with `refetchOnWindowFocus:false`, `staleTime: 5min`, `retry:1` (`main.tsx:13-21`)
5. `AuthProvider` (`main.tsx:28`, `src/contexts/AuthContext.tsx:53`)
6. `TabProvider` (`main.tsx:29`, `src/contexts/TabContext.tsx:40`)
7. `RouterProvider router={router}` (`main.tsx:30`) + `AppToaster` (`main.tsx:31`, sonner Toaster)

# Not in the global stack

`ReaderProvider` and `ChatControllerProvider` are **scoped inside `Layout`**:
`Layout.tsx:181` wraps everything in `ReaderProvider`; `Layout.tsx:224-227`
conditionally wraps the workspace in `ChatControllerProvider` keyed by the
current paper id. See [state-management.md](state-management.md).
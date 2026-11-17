---
type: Feature Plan
title: Desktop App
description: Plan for Lumen for Mac, a native GPUI client on the same API, built after Learning for Mac with its shared kit and PDF viewer. Covers scope, native Google sign-in, milestones and risks.
tags: [feature-plan, desktop, gpui, planned]
timestamp: 2026-11-16T00:00:00Z
---

# Desktop App

A native macOS app for Lumen, built with GPUI like Learning for Mac, on the same FastAPI backend. It's the third desktop app after SpeakUp and Gradfile, and the largest (45.6k lines of frontend TypeScript, against Learning's 29.5k). It's also the closest to Learning: reading PDFs, annotating them, chatting about them, and a graph. The cross-app roadmap and the shared kit are in `learning-app/desktop/docs/roadmap.md`.

# Why a desktop app

Lumen is a reading tool, and reading is where a browser gets in the way.

- Papers open in their own windows, side by side, instead of tabs.
- A downloaded or dropped-in PDF goes straight to Ingest.
- Deep research runs keep going with the window closed, and a notification says when one finishes.
- The library can keep recently opened papers on disk, so they open instantly and read offline.

# Scope

In: home and dashboard, papers list and groups, paper detail with the reader, annotations and selection actions, paper chat, search (full text and semantic), ingest from URL and upload, citations and the citation map, authors, discovery, Hugging Face papers and recommendations, deep research and its archive, export, AI provider settings, light, dark and dark reading.

Out for v1: admin login and user management (they stay on the web), the landing site, Windows and Linux.

# Sign-in

The web signs in with Google Identity Services, which hands the browser a Google ID token that it posts to `/auth/google` ([/frontend/auth-flow.md](/frontend/auth-flow.md)). The desktop app can get an ID token itself, through Google's installed-app flow: open the browser with PKCE and catch the redirect on a loopback port. So Lumen doesn't need the server hand-off route that Learning and Gradfile do. It needs one smaller change: `verify_id_token` (`backend/app/core/security.py`) checks the token's audience against the single web client ID, and has to accept a desktop client ID as well. Record it as an ADR.

The refresh token stays in an httpOnly cookie, kept in the kit's Keychain-backed cookie jar. The access token lives in memory and is refreshed before it expires, as the web does it.

# Milestones

| # | Milestone | Ends with | Size |
|---|---|---|---|
| L0 | Audience | `/auth/google` accepts the desktop client's ID tokens, with a test | S |
| L1 | Shell | The app on `desktop-kit`, tokens from the frontend styling docs, native Google sign-in, navigation, home | M |
| L2 | Library | Papers list, groups and the groups finder, tags, reading status, ingest from URL, upload and drag-in | L |
| L3 | Reader | Paper detail with the `gpui-pdf` fork: annotations, selection actions, deep links, dark reading, one window per paper | L |
| L4 | Chat | Paper chat over SSE with sessions, and the AI search stream | M |
| L5 | Discovery | Search, citations and the citation map, authors, discovery, Hugging Face papers, recommendations | L |
| L6 | Deep research | Runs with cursor-based SSE replay, evidence, follow-ups, cancel, the archive, notifications when a run finishes | M |
| L7 | Dashboard and polish | Charts, export, settings and AI providers, Reduce Motion, Increase Contrast, offline copies of recent papers, release | M |

L4 and L5 can run side by side once L3 is done. L6 needs L4's SSE client.

# Known risks

- **The reader (L3).** This is the biggest piece of work. The web viewer is a fork of react-pdf with Lumen-specific hooks ([/frontend/pdf-reader.md](/frontend/pdf-reader.md)). Learning's patched `gpui-pdf` already covers selection, highlights, outlines and named-destination links. Check how it handles real arXiv papers, and how fast it is on a 60-page paper, before planning L3 in detail.
- **The citation map (L5).** The web draws it with React Flow. Learning's journey graph draws a pannable, zoomable graph in GPUI and is the starting point. Force layout isn't covered there yet.
- **Charts (L7).** There's no recharts in GPUI. The dashboard's charts are few enough to draw by hand on a canvas, the way Learning draws its activity graph.
- **Deep research replay (L6).** Runs resume from a cursor after a dropped stream ([/decisions/resumable-agent-runs.md](/decisions/resumable-agent-runs.md)). The SSE client has to send the last cursor when it reconnects, and the tests should drop the stream on purpose.

# Testing

Write tests against a local stack from Docker Compose, never lumen.pkab.work. Compare every screen with the web app in both themes before calling a milestone done.

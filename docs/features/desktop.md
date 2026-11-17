---
type: Feature Plan
title: Desktop App
description: Plan for Lumen for Mac, a native GPUI client on the same API. Three window kinds (Library, Paper, Research), native macOS chrome over Lumen's own look, Google sign-in through the installed-app flow, and milestones that each end in something usable.
tags: [feature-plan, desktop, gpui, planned]
timestamp: 2026-11-17T00:00:00Z
---

# Desktop App

Lumen for Mac is a native macOS app for Lumen, written in GPUI like Learning for Mac and talking to the same FastAPI backend as the web app. It is the second desktop app after Learning. The cross-app roadmap is `learning-app/desktop/docs/roadmap.md`. The design is on the canvas at https://claude.ai/artifact/ArfvoguMnFgTqLGyMqVHZN: the `Native*` boards are the target chrome, and the other boards show content and tokens taken from `frontend-v2/src`.

# Why a desktop app

Lumen is a reading tool, and reading is where a browser gets in the way.

- Each paper opens in its own window, so two papers can sit side by side.
- A PDF dropped on any window goes straight to Add Paper.
- A deep-research run has its own window, keeps going when that window closes, and posts a notification when it's done.
- Recently opened papers can be kept on disk, so they open instantly and read offline.

# Windows

The structure comes from UNMS Research: one library window, plus a window for every paper and every research run.

| Window | How many | What it holds |
|---|---|---|
| Library | One (⌥⌘N opens another) | The sidebar and every page the web sidebar reaches |
| Paper | One per paper | The reader, its toolbar and the inspector. Paper windows share a tabbing identifier, so macOS tabs them together and a tab can be dragged out into its own window |
| Research | One per run | The question, run summary, thinking trace, streaming report and its citations |

Opening a paper or run that already has a window brings that window forward. Learning does this for sources in `src/app/reader_window.rs`, and the same registry pattern covers both kinds here. Paper and research windows close when the user signs out.

A research run lives on the server, so closing its window doesn't stop it. The app keeps a light poll on unfinished runs and posts a system notification when one finishes or fails.

These work from any window:

- **⌘K search.** The Home search box and its router: Your library, New papers, AI overview, Deep dive, plus paper results and recent runs.
- **Add Paper (⌘O).** The Ingest page as a sheet on the current window: drop PDFs, paste links, pick a group.
- **Settings (⌘,).** Its own window.
- **Notifications.** Web toasts for background work (processing finished, research done, failures) become system notifications. Toasts about the thing you just did stay in the window.

# Where every web screen goes

Only User Management and the admin login stay on the web. The account menu hides User Management for regular users anyway, so the desktop menu loses nothing.

| Web route | Desktop |
|---|---|
| `/login` | The sign-in screen in the library window |
| `/` Home | Library window, sidebar ▸ Home |
| `/dashboard` | Library ▸ Dashboard |
| `/papers` | Library ▸ Library, grid or list (⌘1, ⌘2) |
| `/papers/:id` | A paper window |
| `/papers/:id/chat` | The paper window with the inspector on Chat, widened (⇧⌘C) |
| `/groups`, `/groups/:id` | Library ▸ Groups (the finder), and the Folders tree in the sidebar |
| `/search` | ⌘K, with a full results page in the library window |
| `/ingest` | The Add Paper sheet |
| `/export` | File ▸ Export… (⇧⌘E), a sheet |
| `/discovery` | Library ▸ Discover ▸ Discovery |
| `/discovery-archive` | Library ▸ Discover ▸ Discovery Archive |
| `/deep-research` | Library ▸ Discover ▸ Deep Research: the composer and recent runs. Starting a run opens a research window |
| `/deep-research-archive` | Library ▸ Discover ▸ Research Archive |
| `/huggingface-papers` | Library ▸ Discover ▸ HF Papers |
| `/recommendations` | Library ▸ Discover ▸ For You |
| `/annotations` | Library ▸ Tools ▸ Annotations |
| `/citations` | Library ▸ Tools ▸ Citations |
| `/author`, `/author/:id` | Library ▸ Tools ▸ Authors |
| `/settings` | The Settings window: General, AI Providers, Appearance, Account. Account holds the web's Profile and Security sections (sign out, delete account) |
| `/admin/users`, `/admin/login` | Stay on the web |

# macOS chrome

GPUI draws every control itself, so "native" here means macOS sizes, materials and behaviour, not AppKit widgets.

- **Sidebar.** A full-height source list with the traffic lights over it. The translucency is GPUI's blurred window background (`WindowBackgroundAppearance::Blurred`) showing through a sidebar with no fill.
- **Unified toolbar.** 52pt tall, with the page title and subtitle on the left, then search, + and the inspector toggle on the right.
- **Inspector.** The paper window's trailing panel: Details, Insights (Summary, Insights, Guide), Related, Chat, Notes, Annotations, Bookmarks. In the research window it holds the citations (All, Library, Academic, Web).
- **Sheets.** Add Paper and Export slide down from the toolbar of the window they belong to.
- **Settings.** Its own window, with a toolbar of icon tabs, as macOS preferences windows do.
- **Menus.** Real system menus through `cx.set_menus`: Lumen, File, Edit, View, Paper, Window, Help, as drawn on the `NativeMenuBar` board. Context menus, popovers, segmented controls, search fields and focus rings are drawn by GPUI to macOS sizes.
- **Type.** SF Pro (the system font) for chrome: 13pt body and controls, 11pt secondary text and section headers. Inter for paper titles, chat and reports. PDFs keep their own fonts.
- **Lumen's look.** The colour tokens and eight paper themes from `index.css`, the logo, and the paper cards. The accent is forest black `#232927`. Dark mode follows the system appearance.

# Shortcuts

From the `NativeMenuBar` board. The ones that move away from the web, to avoid clashing with macOS:

| Action | Shortcut | Why |
|---|---|---|
| Add Paper | ⌘O | ⌘N is New Research |
| Open a paper from a list | ⌘↓ | ⌘O is taken; Finder uses ⌘↓ |
| Highlighter tool | ⇧⌘H | ⌘H is Hide |
| Highlight selection | ⌃⌘H | |
| Previous / next page | ⌘[ / ⌘] | |
| Previous / next tab | ⇧⌘[ / ⇧⌘] | The macOS default for window tabs |
| Chat about paper | ⇧⌘C | |
| Search library | ⌘K | |

# Sign-in

The web gets a Google ID token from Google Identity Services and posts it to `/auth/google` ([/frontend/auth-flow.md](/frontend/auth-flow.md)). The desktop app gets its own ID token through Google's installed-app flow, so it needs no server hand-off route like Learning's:

1. Start a listener on `127.0.0.1` on a free port.
2. Open Google's consent page in the browser with a PKCE challenge, a `state` value and that loopback address as the redirect.
3. Catch the redirect, check `state`, and trade the code and PKCE verifier for tokens at Google's token endpoint.
4. Post the ID token to `/auth/google`, the same call the web makes.

The server checks the token's audience in `verify_google_id_token` (`backend/app/core/security.py`), and today it only accepts the web client ID. Milestone L0 makes it accept a desktop client ID as well ([/decisions/desktop-oauth-audience.md](/decisions/desktop-oauth-audience.md)).

Google issues a client secret for desktop clients and says it can't be kept secret in an installed app. PKCE is what protects the flow, so shipping that value in the binary is expected.

After sign-in, Lumen works like the web: a short-lived access token sent as a Bearer header and kept only in memory, refreshed a minute before it expires, and a refresh token in an httpOnly cookie. The cookie jar is saved to the Keychain, so the app stays signed in across launches.

# Where the code lives

A `desktop/` folder in this repo, holding one Cargo crate, `lumen-desktop`, set out the way Learning's is: `api` (HTTP, SSE, types), `state`, `theme`, `ui`, `screens`, `app` (windows, routes, menus). The pins are the same as Learning's: `gpui-pre` =0.3.12, gpui-component 0.9.1, `gpui-pre-platform` with the `font-kit` feature, and the vendored `gpui-pdf` patch.

## Reusing Learning's code

The roadmap says to pull a shared `desktop-kit` out of Learning when the second app starts, and Lumen is the second app. There are two ways to do it.

**Copy now, extract later (chosen).** Copy the generic pieces (HTTP runtime, SSE parser, Keychain cookie jar, query cache, prefs, motion, buttons, fields, icons, markdown, the bundle script) into `desktop/src/kit/`, laid out the way the kit's crates would be. Note the Learning commit each file came from. Extract `desktop-kit` once Lumen's L2 lands, and move both apps onto it then.

- For: L1 starts now. Learning, which has shipped, isn't touched until the seams are known. Lumen's first needs are exactly the places it differs from Learning: Bearer tokens instead of a CSRF cookie, a loopback redirect instead of a URL scheme, several window kinds, real menus, the blurred sidebar. Extracting first would mean guessing at those seams, which is what the roadmap warns against.
- Against: for a few weeks, a bug in a copied file has to be fixed in both places.

**Extract first.** Make `desktop-kit` the first milestone, move Learning onto it, then start Lumen on top of it.

- For: no duplicate code, ever.
- Against: one more milestone before Lumen draws anything, a release of Learning that changes nothing for its users, and kit APIs designed before Lumen has used them.

The PDF fork goes to its own repo either way, at the start of L3, since that's where Lumen first needs it.

# Milestones

Each one ends with the app building, running against a local Docker Compose stack, and a side-by-side check against the web app in both themes.

| # | Milestone | Ends with | Size |
|---|---|---|---|
| L0 | Audience | `/auth/google` accepts ID tokens from the desktop client ID, with a test and an ADR | S |
| L1 | Shell | Sign in with Google and stay signed in. The library window with the translucent sidebar, toolbar and real menus. Every sidebar item navigates, and Home shows recent papers. Settings ▸ Account signs out | M |
| L2 | Library | Library grid and list, Groups finder, the Folders tree, tags, reading status and priority, the paper context menu, the Add Paper sheet (links, uploads, drag-in), ⌘K over the library, a notification when processing finishes | L |
| L3 | Paper window | One window per paper with native tabs, the reader on the `gpui-pdf` fork, highlights in the eight paper themes, the selection popover, comments, bookmarks, zen mode and dark reading. Inspector: Details, Notes, Annotations, Bookmarks | L |
| L4 | Chat | Inspector Chat and Insights over SSE, sessions, the provider picker, prompts and @-mentions, Explain / Why / Define, ⌘K AI overview, Settings ▸ AI Providers | M |
| L5 | Discovery | Discovery, HF Papers, For You, the search page, Citations graph, Authors, the inspector's Related tab | L |
| L6 | Research windows | One window per run, resuming from the last cursor after a dropped stream, evidence and citations, follow-ups, cancel, Research Archive, notifications when a run ends | M |
| L7 | Dashboard and release | Dashboard charts, Export, Settings ▸ Appearance and General, offline copies of recent papers, Reduce Motion and Increase Contrast, a signed `.app` | M |

L4 and L5 can run side by side after L3. L6 needs L4's streaming client.

# Decisions

Settled with the user on 2026-11-17, from the design's open questions.

1. **Dark accent.** As on the web: forest black in light mode, `#E2E2E2` in dark, so dark selections are light pills with dark text.
2. **Type scale.** 1 rem = 16pt, not the web's 110%. Content sits about 10% denser than in the browser, matching 13pt system chrome.
3. **Icons.** Lumen's own icon paths, drawn outline-only at about 1.35px. No SF Symbols.
4. **Code reuse.** Copy now, extract `desktop-kit` after L2.
5. **Sidebar.** Research Archive and Discovery Archive both sit under Discover. The account lives in Settings ▸ Account and Lumen ▸ Sign Out.
6. **Shortcuts.** As in the table above.
7. **Inspector counts (L3).** In the open section's title ("Annotations · 12") and in each tab's tooltip.
8. **Research citations (L6).** In the trailing inspector, like the paper window.

# Progress

- **L0 (Audience): built.** `GOOGLE_DESKTOP_CLIENT_ID` is a second accepted audience ([/decisions/desktop-oauth-audience.md](/decisions/desktop-oauth-audience.md)).
- **L1 (Shell): built, not yet checked on screen.** `desktop/` compiles clean with 22 tests. Sign-in restores from the saved refresh cookie, and sessions survive relaunches against a local stack. The library window has the sidebar, toolbar and real menus. Home shows recent papers. Settings has a working Account tab. Still to do: a look at both themes beside the design boards, and a real Google sign-in, which needs a Desktop OAuth client (`LUMEN_GOOGLE_CLIENT_ID`, `LUMEN_GOOGLE_CLIENT_SECRET`) and the same ID on the server.
- **L1 notes.** Copied files from Learning sit in `desktop/src/kit/` with a header naming the source commit. Debug builds outside a `.app` keep the session in an owner-only file instead of the Keychain, so a rebuild doesn't bring up a Keychain prompt. The app quits when its last window closes. L6 has to change that, so research runs can still post notifications. Building on a Mac without Xcode's Metal toolchain fails in `gpui-pre-apple`; install it with `xcodebuild -downloadComponent MetalToolchain`.

# Known risks

- **The reader (L3).** The biggest piece of work. The web viewer is a fork of react-pdf with Lumen-specific hooks ([/frontend/pdf-reader.md](/frontend/pdf-reader.md)). Learning's patched `gpui-pdf` covers selection, highlights, outlines and named-destination links. Test it on real arXiv papers, and time a 60-page paper, before planning L3 in detail.
- **The citation map (L5).** The web draws it with React Flow. Learning's journey graph is a pannable, zoomable graph in GPUI and is the place to start. It has no force layout yet.
- **Charts (L7).** GPUI has no charting library. The dashboard has few enough charts to draw by hand, as Learning draws its activity graph.
- **Research replay (L6).** Runs resume from a cursor after a dropped stream ([/decisions/resumable-agent-runs.md](/decisions/resumable-agent-runs.md)). The streaming client has to send the last cursor when it reconnects, and the tests should drop the stream on purpose.
- **The blurred sidebar (L1).** GPUI's blurred background blurs the whole window, so everything outside the sidebar needs an opaque fill. Check that text stays crisp and that it looks right on a plain desktop.

# Testing

Test against a local stack from Docker Compose, never lumen.pkab.work. Debug builds point at the local API, release builds at the live site. Compare every screen with the web app in both themes before calling a milestone done.

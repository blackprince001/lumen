---
type: Component Catalog
title: Frontend Components
description: Component directory layout by category — layout shell, reader, chat, ai, citation-map, discovery, finder, ingest, ui primitives, shadcn primitives, and root feature components.
resource: frontend-v2/src/components
tags: [frontend, components, catalog]
timestamp: 2026-06-28T00:00:00Z
---

`frontend-v2/src/components/`. Two primitive layers share the same CSS vars:
in-house `ui/*` (Logically tokens) and shadcn `shadcn/*` (Radix-based, used by
the PDF/document blocks and Finder).

# Layout / shell (`components/layout/`)

- `Layout.tsx:66` — 3-column resizable workspace (Sidebar | center Navbar+Outlet | ChatPanel), drag dividers, mobile drawer, conditionally wraps in `ChatControllerProvider` for paper routes.
- `Sidebar.tsx:150` — nav (Core/Discover/Tools sections), collapsible, dynamic group folder tree (`buildGroupTree`), admin link, `UserMenu`.
- `Navbar.tsx:88` — breadcrumb builder (resolves paper/group names via queries), chat-toggle button.
- `TabBar.tsx:7` — browser-style open-paper tabs from `TabContext`.
- `ChatPanel.tsx:28` — right rail with 7 tabs: Details, Insights (summary/findings/guide/highlights), Related, Chat, Notes, Annotations, Bookmarks.

# Reader / PDF (`components/reader/`) — see [pdf-reader.md](pdf-reader.md)

`ReaderShell.tsx`, `SelectionPopover.tsx`, `HighlighterControl.tsx`,
`AnnotationCard.tsx`, `AnnotationMarker.tsx`, `AnnotationsPanel.tsx`,
`OutlinePanel.tsx`, `ReaderToolbarActions.tsx`, plus helpers
`annotation-geometry.ts`, `highlight-colors.ts`, `toc.ts`, `use-paper-file.ts`.

# PDF/document viewers (`components/shadcn/`) — forked shadcn blocks

`pdf-viewer.tsx` (the viewer — see [pdf-reader.md](pdf-reader.md)),
`document-viewer-sidebar.tsx`, `file-thumbnail.tsx`, `file-system.tsx`
(Finder block), `docx-viewer.tsx` (`@extend-ai/react-docx`),
`xlsx-viewer.tsx` (`@extend-ai/react-xlsx`), `layout-blocks.tsx`, plus Radix
primitives: `button, command (cmdk), dialog, dropdown-menu, input, popover,
resizable (react-resizable-panels), scroll-area, select, separator, spinner,
tabs, tooltip`.

# Chat (`components/chat/`)

`ChatComposer.tsx:38` (input + prompt groups + mention autocomplete),
`ChatMessageList.tsx:27` (virtualized message list), `SessionPills.tsx:14`
(session switcher). See [chat-system.md](chat-system.md).

# AI streaming UI (`components/ai/`)

`StreamingMessage.tsx`, `AgentThoughtPanel.tsx`, `ToolCallIndicator.tsx`,
`MessageAuthor.tsx`, `ProviderPicker.tsx`, `ErrorBanner.tsx`.

# Discovery (`components/discovery/`)

`SourceSelector`, `ResearchOverview`, `ClusteredResults`,
`DiscoveredPaperCard`, `CitationExplorer`, `SavedDiscoveriesPanel`,
`AddToLibraryDialog`, `DiscoveryStatus`.

# Citation map (`components/citation-map/`)

`CitationMap.tsx` (graph viz via `@xyflow/react` + `react-force-graph-2d`),
`CitedByTab`, `FocalPaperPicker`, `NodeDetailPanel`, `ReferenceNode`.

# Finder, ingest, author (`components/{finder,ingest,author}/`)

`finder/PaperInfoPanel.tsx`; `ingest/UploadHero.tsx`,
`ingest/UrlChipsInput.tsx`; `author/AuthorBits.tsx`.

# UI primitives (in-house design system) (`components/ui/`)

`Button`, `Card`, `Dialog`, `Tabs`, `Table`, `Select`, `Input`, `Textarea`,
`Skeleton`, `Badge`, `Accordion`, `Pagination`, `Progress`, `Tooltip`,
`Popover`, `SearchInput`, `PaperCoverPlaceholder`.

# Shared feature components (`components/` root)

`PaperCard`, `PaperTable`, `PaperDetails`, `AISummary`, `KeyFindings`,
`ReadingGuide`, `AutoHighlights`, `NotesPanel`, `RelatedPapers`,
`PaperCitationsList`, `PaperAnnotationsPanel`, `ChatTab`, `BookmarksTab`,
`AnalysisSidebar`, `MessageThread`, `MarkdownMessage` (react-markdown +
remark-gfm/math + rehype-katex/sanitize + syntax-highlighter),
`MentionAutocomplete`, `GroupChatPanel`, `GroupChatSidebar`, `GroupTreeSelector`,
`ReferenceChip`, `ReferenceManifestProvider`, `ReadingProgressBar`,
`ReadingStatusBadge`, `ProcessingStatusBadge`, `PriorityBadge`, `FilterChip`,
`SortFilterBar`, `TagInput`, `TagList`, `ShareDialog`, `MovePapersDialog`,
`ConfirmDialog`, `Breadcrumb`, `Logo`, `UserMenu`, `AppToaster`,
`ProtectedRoute`, `pdf-block-resizable-shell.tsx`, `ExpandedInput`.
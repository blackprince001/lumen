---
type: Module
title: Frontend PDF Reader & Annotations
description: The forked virtualized react-pdf viewer (PAPERS-FORK hooks), the ReaderShell orchestrator, per-page annotation overlay, selection capture, highlighter, deep-linking, and dark reading.
resource: frontend-v2/src/components/shadcn/pdf-viewer.tsx
tags: [frontend, pdf, reader, annotations, pdfjs, react-pdf]
timestamp: 2026-06-28T00:00:00Z
---

The reader combines a **forked** shadcn-style PDF block with a reader
orchestrator that adds annotation capture, AI selection actions, and
deep-linking.

# `components/shadcn/pdf-viewer.tsx` — the viewer

Built on **`react-pdf@10.4.1`** + **`pdfjs-dist@5.4.296`**. `react-pdf` is
**dynamically imported** (`pdf-viewer.tsx:858-879`); `pdfjs.GlobalWorkerOptions.workerSrc`
is set to the unpkg worker for the matching version (`:179-181`, `:860-862`).

CMaps/standard fonts: `getDefaultPdfDocumentOptions` points at unpkg
(`:183-197`), but the **reader** overrides this to self-hosted
`/pdfjs/cmaps/` and `/pdfjs/standard_fonts/` (copied by the `copy-pdfjs`
postinstall script, `package.json:11-12`). `public/pdfjs/` exists.

- **Virtualized continuous scroll** via `@tanstack/react-virtual` `useVirtualizer` (`:954-963`), with scroll-velocity-aware render buffering (`fastAheadBuffer`/`fastBehindBuffer`, `:1120-1171`).
- DPR-drop-while-zooming then re-raster on settle (`:889-904`); per-page metrics caching (`:999-1059`); thumbnail sidebar virtualizer (`:1109-1118`); in-document text search highlighting (`:602-679`); rotate + download-with-rotations via `pdf-lib` (`:261-302`).
- `PDFViewerHandle` imperative API (`:67-78`): `scrollToPage`, `scrollToPageArea`, `getViewportElement`, `setZoom`, `getZoom` — the last three are `PAPERS-FORK` additions (`:75-77`, `:1441-1447`).
- Other `PAPERS-FORK` hooks: `onDocumentProxy` (`:121`), `outlinePanel` slot (`:123`), `renderPageOverlay` (`:117`), `onPagePointerDown/Move/Up/Cancel` (`:125-140`).

# `components/reader/ReaderShell.tsx:59` — the orchestrator

- Loads the PDF through the authenticated API as a Blob → object URL via `hooks/use-paper-file.ts:24-45` (revokes on unmount/paper change).
- Mounts `<PDFViewer>` with `renderPageOverlay={renderPageOverlay}` (`ReaderShell.tsx:567`) which draws per page: (a) highlight rectangles from normalized `selection_data.rects` (`:407-437`); (b) **margin annotation cards** with SVG leader lines when side gutters are wide enough (`:439-499`), or **inline `AnnotationMarker`s** otherwise (`:501-521`). Color comes from `reader/highlight-colors.ts` → CSS vars `--theme-{name}-action`.
- **Selection capture** (`handlePagePointerUp`, `ReaderShell.tsx:299-364`): on pointerup, reads `window.getSelection()`, normalizes each `ClientRect` to 0–1 page-relative rects; creates an instant highlight if the `HighlighterControl` pen is armed (`:342-351`), otherwise opens the `SelectionPopover`.
- `components/reader/SelectionPopover.tsx:28` — floating actions: AI actions (Explain/Why/Define → `aiFeaturesApi.aiAction`), color-swatch one-off highlights, and a comment box (creates an `annotation`-type annotation, `ReaderShell.tsx:237-260`).
- `components/reader/HighlighterControl.tsx:11` — floating pen button + color popover (8 themes).
- `components/reader/AnnotationsPanel.tsx:10` — side list sorted by page then anchor Y; click → `reader.scrollCallbacks.scrollToAnnotation` (registered via `ReaderContext`, `ReaderShell.tsx:161-164`) which calls `viewerRef.scrollToPageArea`.
- `components/reader/OutlinePanel.tsx:48` + `utils/toc.ts:11` — extracts the PDF outline (`pdf.getOutline`) and resolves destinations to page numbers; rendered into the viewer's `outlinePanel` slot.
- Deep-linking: `?page=N` and `?focus=annotation:22` (parsed in `PaperDetail.tsx:20-23`) scroll to the target on load (`ReaderShell.tsx:166-203`).
- Zen mode: full-screen toggle at zoom ≥ 1.5 (`ReaderShell.tsx:88-109`).
- Dark reading: wraps viewer in `data-reader-dark`; the CSS `filter: invert(1) hue-rotate(180deg)` applies only to `.react-pdf__Page canvas` (`index.css:674`); `hooks/use-pdf-dark-mode.ts:22` refines image regions.

# Annotation geometry

`reader/annotation-geometry.ts`: `annotationPage`, `annotationRects` (per-line
rects with fallback to legacy `boundingBox`), `annotationAnchorY`. Types:
`annotation` (highlights/comments) vs `note` (freeform); `type`/`highlight_type`
drive the color theme mapping in `highlight-colors.ts:6-14`.

# Permissions

`lib/utils/permissions.ts`: `isOwner`/`canEdit`/`canAnnotate`/`isViewer` gate
which actions show (e.g. only owners can share, editors+ can annotate/bookmark
— `ReaderToolbarActions.tsx:101,113`). Mirrors backend
[`services/access`](/backend/services/access.md).
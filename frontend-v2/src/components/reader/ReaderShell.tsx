import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { Warning2 as AlertCircle } from 'iconsax-reactjs';
import { annotationsApi, type Annotation } from '@/lib/api/annotations';
import { aiFeaturesApi, type AIActionKind } from '@/lib/api/aiFeatures';
import { papersApi, type Paper } from '@/lib/api/papers';
import {
  PDFViewer,
  type PDFViewerHandle,
  type PDFViewerPageOverlayProps,
} from '@/components/shadcn/pdf-viewer';
import {
  getOcrBlocks,
  blockToArea,
  OcrBlockOverlay,
  type OcrBlock,
  type ParsedOcrOutput,
} from '@/components/shadcn/layout-blocks';
import { canAnnotate } from '@/lib/utils/permissions';
import { toastError, toastSuccess } from '@/lib/utils/toast';
import { cn } from '@/lib/utils';
import { useReader } from '@/contexts/ReaderContext';
import { usePaperFile } from './use-paper-file';
import { annotationPage, annotationRects, type NormalizedRect } from './annotation-geometry';
import { highlightTheme } from './highlight-colors';
import type { ThemeName } from '@/lib/paper-themes';
import { AnnotationCard } from './AnnotationCard';
import { OutlinePanel } from './OutlinePanel';
import { ReaderToolbarActions } from './ReaderToolbarActions';
import { SelectionPopover, type SelectionState } from './SelectionPopover';

const PDF_DOCUMENT_OPTIONS = {
  cMapPacked: true,
  cMapUrl: '/pdfjs/cmaps/',
  standardFontDataUrl: '/pdfjs/standard_fonts/',
};

/** Gutter cards need this much width beyond the page to render. */
const MARGIN_CARD_WIDTH = 264;
const MARGIN_CARD_GAP = 10;
const MARGIN_CARD_MIN_HEIGHT = 72;

interface ReaderShellProps {
  paper: Paper;
  annotations: Annotation[];
  onAnnotationSuccess: () => void;
  onCurrentPageChange?: (page: number) => void;
}

export function ReaderShell({
  paper,
  annotations,
  onAnnotationSuccess,
  onCurrentPageChange,
}: ReaderShellProps) {
  const queryClient = useQueryClient();
  const { fileUrl, error: fileError } = usePaperFile(paper);
  const viewerRef = useRef<PDFViewerHandle>(null);
  const [pdfProxy, setPdfProxy] = useState<PDFDocumentProxy | null>(null);
  const [activePage, setActivePage] = useState(1);
  const {
    activeAnnotationId,
    setActiveAnnotationId,
    activeBlockId,
    setActiveBlockId,
    registerScrollCallbacks,
    unregisterScrollCallbacks,
  } = useReader();
  const [selection, setSelection] = useState<SelectionState | null>(null);
  const [pendingAction, setPendingAction] = useState<AIActionKind | null>(null);
  const [isDark, setIsDark] = useState(false);
  const [highlighterActive, setHighlighterActive] = useState(false);
  const [highlighterColor, setHighlighterColor] = useState<ThemeName>('yellow' as ThemeName);

  const highlights = useMemo(
    () => annotations.filter((a) => a.type !== 'note' && annotationRects(a).length > 0),
    [annotations]
  );

  const byPage = useMemo(() => {
    const map = new Map<number, Annotation[]>();
    for (const ann of highlights) {
      const page = annotationPage(ann);
      if (page === null) continue;
      if (!map.has(page)) map.set(page, []);
      map.get(page)!.push(ann);
    }
    return map;
  }, [highlights]);

  /* ── layout blocks (Layout tab) ─────────────────────────────────────── */

  const { data: layout } = useQuery({
    queryKey: ['paper-layout', paper.id],
    queryFn: () => papersApi.getLayout(paper.id),
    staleTime: Infinity,
    retry: false,
  });
  const ocrBlocks = useMemo(
    () => (layout ? getOcrBlocks(layout as ParsedOcrOutput) : []),
    [layout]
  );

  /* ── navigation ─────────────────────────────────────────────────────── */

  const scrollToAnnotation = useCallback((annotation: Annotation) => {
    const page = annotationPage(annotation);
    const rect = annotationRects(annotation)[0];
    if (page === null) return;
    setActiveAnnotationId(annotation.id);
    viewerRef.current?.scrollToPageArea(
      page,
      rect
        ? {
            left: rect.left * 100,
            top: rect.top * 100,
            width: rect.width * 100,
            height: rect.height * 100,
          }
        : { top: 0 },
      { behavior: 'smooth' }
    );
  }, []);

  const focusBlock = useCallback((block: OcrBlock) => {
    setActiveBlockId(block.id);
    const area = blockToArea(block);
    viewerRef.current?.scrollToPageArea(
      block.page,
      {
        left: Number.parseFloat(String(area.left)),
        top: Number.parseFloat(String(area.top)),
        width: Number.parseFloat(String(area.width)),
        height: Number.parseFloat(String(area.height)),
      },
      { behavior: 'auto' }
    );
  }, []);

  /* ── register scroll callbacks with ReaderContext ──────────────────── */

  useEffect(() => {
    registerScrollCallbacks({
      scrollToAnnotation,
      scrollToBlock: focusBlock,
    });
    return () => unregisterScrollCallbacks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollToAnnotation, focusBlock, registerScrollCallbacks, unregisterScrollCallbacks]);

  /* ── mutations ──────────────────────────────────────────────────────── */

  const invalidateAnnotations = () => {
    void queryClient.invalidateQueries({ queryKey: ['annotations', paper.id] });
    onAnnotationSuccess();
  };

  const deleteMutation = useMutation({
    mutationFn: (id: number) => annotationsApi.delete(id),
    onSuccess: invalidateAnnotations,
    onError: () => toastError('Failed to delete annotation'),
  });

  const handleAIAction = async (kind: AIActionKind) => {
    if (!selection) return;
    setPendingAction(kind);
    try {
      const annotation = await aiFeaturesApi.aiAction(paper.id, {
        action: kind,
        selection_text: selection.text,
        page: selection.page,
        rects: selection.rects,
      });
      invalidateAnnotations();
      setSelection(null);
      setActiveAnnotationId(annotation.id);
      toastSuccess('Saved as annotation');
    } catch (error) {
      toastError(`AI action failed: ${(error as Error).message}`);
    } finally {
      setPendingAction(null);
    }
  };

  const handleComment = async (text: string) => {
    if (!selection) return;
    try {
      const annotation = await annotationsApi.create({
        paper_id: paper.id,
        content: text,
        type: 'annotation',
        highlighted_text: selection.text,
        selection_data: { rects: selection.rects },
        coordinate_data: {
          page: selection.page,
          x: selection.rects[0] ? selection.rects[0].left + selection.rects[0].width / 2 : 0.5,
          y: selection.rects[0]?.top ?? 0,
        },
      });
      invalidateAnnotations();
      setSelection(null);
      setActiveAnnotationId(annotation.id);
    } catch {
      toastError('Failed to save comment');
    }
  };

  /** Create a color-only highlight annotation from text selection. */
  const createHighlight = useCallback(
    async (color: ThemeName, sel: SelectionState) => {
      try {
        const annotation = await annotationsApi.create({
          paper_id: paper.id,
          content: sel.text,
          type: 'annotation',
          highlighted_text: sel.text,
          selection_data: { rects: sel.rects, color },
          coordinate_data: {
            page: sel.page,
            x: sel.rects[0] ? sel.rects[0].left + sel.rects[0].width / 2 : 0.5,
            y: sel.rects[0]?.top ?? 0,
          },
        });
        invalidateAnnotations();
        setSelection(null);
        setActiveAnnotationId(annotation.id);
      } catch {
        toastError('Failed to create highlight');
      }
    },
    [paper.id, invalidateAnnotations],
  );

  /** Called from SelectionPopover swatch row. */
  const handleHighlight = useCallback(
    (color: ThemeName) => {
      if (!selection) return;
      void createHighlight(color, selection);
    },
    [selection, createHighlight],
  );

  /* ── text selection capture ─────────────────────────────────────────── */

  const handlePagePointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>, pageNumber: number) => {
      if (!canAnnotate(paper)) return;
      const pageElement = event.currentTarget;

      // The browser finalizes the selection after pointerup.
      window.setTimeout(() => {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;
        const range = sel.getRangeAt(0);
        if (!pageElement.contains(range.commonAncestorContainer)) return;
        const text = range.toString().trim();
        if (!text) return;

        const reference = pageElement.querySelector('canvas') ?? pageElement;
        const pageRect = reference.getBoundingClientRect();
        if (pageRect.width === 0 || pageRect.height === 0) return;

        const rects: NormalizedRect[] = [];
        const clientRects = range.getClientRects();
        for (const r of clientRects) {
          if (r.width < 1 || r.height < 1) continue;
          const left = Math.max(0, Math.min(1, (r.left - pageRect.left) / pageRect.width));
          const top = Math.max(0, Math.min(1, (r.top - pageRect.top) / pageRect.height));
          const right = Math.max(0, Math.min(1, (r.right - pageRect.left) / pageRect.width));
          const bottom = Math.max(0, Math.min(1, (r.bottom - pageRect.top) / pageRect.height));
          rects.push({ left, top, width: right - left, height: bottom - top });
        }
        if (rects.length === 0) return;

        // Instant highlight when toolbar highlighter is active.
        if (highlighterActive) {
          void createHighlight(highlighterColor, {
            page: pageNumber,
            text,
            rects,
            clientX: 0,
            clientY: 0,
          });
          return;
        }

        const selectionRect = range.getBoundingClientRect();
        setSelection({
          page: pageNumber,
          text,
          rects,
          clientX: (selectionRect.left + selectionRect.right) / 2,
          clientY: selectionRect.bottom,
        });
      }, 0);
    },
    [paper, highlighterActive, highlighterColor, createHighlight]
  );

  /* ── per-page overlay: highlights + margin cards + layout blocks ────── */

  const containerRef = useRef<HTMLDivElement>(null);

  const renderPageOverlay = useCallback(
    ({ pageNumber, pageWidth, pageHeight, scale }: PDFViewerPageOverlayProps) => {
      const pageAnnotations = byPage.get(pageNumber) ?? [];
      const renderedWidth = pageWidth * scale;
      const renderedHeight = pageHeight * scale;

      // Gutter cards only when the viewer is wide enough to host them.
      const containerWidth = containerRef.current?.clientWidth ?? 0;
      const showMarginCards =
        containerWidth > renderedWidth + (MARGIN_CARD_WIDTH + MARGIN_CARD_GAP) * 2;

      // Stack cards down the gutter at their anchor y, pushing collisions down.
      let cursorY = 0;
      const placed = pageAnnotations
        .map((ann) => {
          const rect = annotationRects(ann)[0];
          const anchorY = (rect?.top ?? 0) * renderedHeight;
          const top = Math.max(anchorY, cursorY);
          cursorY = top + MARGIN_CARD_MIN_HEIGHT + MARGIN_CARD_GAP;
          return { ann, rect, anchorY, top };
        })
        .filter((p) => p.rect);

      return (
        <>
          {/* Highlight rects */}
          {pageAnnotations.map((ann) => {
            const theme = highlightTheme(ann.highlight_type, ann.selection_data);
            return annotationRects(ann).map((rect, i) => (
              <button
                key={`${ann.id}-${i}`}
                type="button"
                aria-label="Annotation highlight"
                onClick={() => {
                  setActiveAnnotationId(ann.id);
                }}
                className={cn(
                  'absolute rounded-[2px] transition-opacity',
                  isDark ? 'mix-blend-screen' : 'mix-blend-multiply',
                  activeAnnotationId === ann.id ? 'opacity-90' : 'opacity-60 hover:opacity-80',
                )}
                style={{
                  left: `${rect.left * 100}%`,
                  top: `${rect.top * 100}%`,
                  width: `${rect.width * 100}%`,
                  height: `${rect.height * 100}%`,
                  backgroundColor: `var(--theme-${theme}-action)`,
                }}
              />
            ));
          })}

          {/* Layout block overlays — visible when a block is selected */}
          {ocrBlocks
            .filter((block) => block.page === pageNumber)
            .map((block) => (
              <OcrBlockOverlay
                key={block.id}
                block={block}
                isActive={block.id === activeBlockId}
              />
            ))}

          {/* Margin cards + leader lines (mockup look) */}
          {showMarginCards && placed.length > 0 && (
            <>
              <svg
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 size-full overflow-visible"
              >
                {placed.map(({ ann, rect, top }) => {
                  const theme = highlightTheme(ann.highlight_type, ann.selection_data);
                  const x1 = (rect!.left + rect!.width) * renderedWidth;
                  const y1 = (rect!.top + rect!.height / 2) * renderedHeight;
                  const x2 = renderedWidth + MARGIN_CARD_GAP;
                  const y2 = top + 16;
                  return (
                    <path
                      key={ann.id}
                      d={`M ${x1} ${y1} C ${(x1 + x2) / 2} ${y1}, ${(x1 + x2) / 2} ${y2}, ${x2} ${y2}`}
                      fill="none"
                      strokeWidth={1.25}
                      style={{ stroke: `var(--theme-${theme}-action)` }}
                      opacity={activeAnnotationId === ann.id ? 0.95 : 0.55}
                    />
                  );
                })}
              </svg>
              <div
                className="absolute top-0"
                style={{ left: renderedWidth + MARGIN_CARD_GAP, width: MARGIN_CARD_WIDTH }}
              >
                {placed.map(({ ann, top }) => (
                  <div key={ann.id} className="absolute w-full" style={{ top }}>
                    <AnnotationCard
                      annotation={ann}
                      active={activeAnnotationId === ann.id}
                      compact
                      onClick={() => setActiveAnnotationId(ann.id)}
                      onDelete={
                        canAnnotate(paper) ? () => deleteMutation.mutate(ann.id) : undefined
                      }
                    />
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [byPage, ocrBlocks, activeBlockId, activeAnnotationId, paper, isDark]
  );

  /* ── render ─────────────────────────────────────────────────────────── */

  if (fileError) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center">
        <AlertCircle size={40} className="mb-3 text-(--destructive) opacity-30" />
        <p className="text-body text-(--muted-foreground)">{fileError}</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="h-full w-full p-3">
      {fileUrl ? (
        <div className="h-full" data-reader-dark={isDark || undefined}>
          <PDFViewer
            ref={viewerRef}
            file={fileUrl}
            documentOptions={PDF_DOCUMENT_OPTIONS}
            showUpload={false}
            toolbarActions={
              <ReaderToolbarActions
                paper={paper}
                currentPage={activePage}
                isDark={isDark}
                highlighterActive={highlighterActive}
                highlighterColor={highlighterColor}
                onToggleDark={() => setIsDark((v) => !v)}
                onToggleHighlighter={() => setHighlighterActive((v) => !v)}
                onHighlighterColorChange={setHighlighterColor}
                onPaperChanged={onAnnotationSuccess}
              />
            }
            renderPageOverlay={renderPageOverlay}
            onPagePointerUp={handlePagePointerUp}
            onDocumentProxy={setPdfProxy}
            onActivePageChange={(page) => {
              setActivePage(page);
              onCurrentPageChange?.(page);
            }}
            // PAPERS-FORK: render outline in sidebar
            outlinePanel={
              <OutlinePanel
                pdf={pdfProxy}
                activePage={activePage}
                onNavigate={(page) =>
                  viewerRef.current?.scrollToPageArea(page, { top: 0 }, { behavior: 'smooth' })
                }
              />
            }
          />
        </div>
      ) : (
        <div className="flex h-full items-center justify-center">
          <div className="size-10 animate-spin rounded-full border-4 border-(--border) border-t-(--sky-blue)" />
        </div>
      )}

      {selection && (
        <SelectionPopover
          selection={selection}
          pendingAction={pendingAction}
          onAIAction={(kind) => void handleAIAction(kind)}
          onHighlight={handleHighlight}
          onComment={(text) => void handleComment(text)}
          onClose={() => {
            if (!pendingAction) setSelection(null);
          }}
        />
      )}
    </div>
  );
}

import { useState, useRef, useEffect, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import { PDFToolbar } from './PDFToolbar';
import { PDFTOC, type TOCItem } from './PDFTOC';
import { FloatingAnnotationForm } from './FloatingAnnotationForm';
import { Warning2 as AlertCircle } from 'iconsax-reactjs';
import { Button } from './ui/Button';
import { type Paper, papersApi } from '@/lib/api/papers';
import { type Annotation } from '@/lib/api/annotations';
import { usePDFDarkMode } from '@/hooks/use-pdf-dark-mode';

// Set worker to a reliable CDN fallback to resolve rendering issues in different environments
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@4.8.69/build/pdf.worker.min.mjs`;

const PDF_OPTIONS = {
  cMapUrl: 'https://unpkg.com/pdfjs-dist@4.8.69/cmaps/',
  standardFontDataUrl: 'https://unpkg.com/pdfjs-dist@4.8.69/standard_fonts/',
};

interface PDFViewerProps {
  paper: Paper;
  annotations: Annotation[];
  onAnnotationSuccess: () => void;
  onCurrentPageChange?: (page: number) => void;
  onNoteAction?: () => void;
}

export function PDFViewer({
  paper,
  annotations,
  onAnnotationSuccess,
  onCurrentPageChange,
  onNoteAction,
}: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [zoom, setZoom] = useState(1.2);
  const [showTOC, setShowTOC] = useState(false);
  const [tocItems, setTocItems] = useState<TOCItem[] | null>(null);
  const [firstPageDimensions, setFirstPageDimensions] = useState<{ width: number; height: number } | null>(null);
  const [pageDimensions, setPageDimensions] = useState<Map<number, { width: number; height: number }>>(new Map());
  const [renderedPageSizes, setRenderedPageSizes] = useState<Map<number, { width: number; height: number }>>(new Map());
  const [floatingFormData, setFloatingFormData] = useState<{
    coordinates: { page: number; x: number; y: number };
    position: { x: number; y: number };
    highlightedText?: string;
    selectionData?: any;
  } | null>(null);
  
  const [rotation, setRotation] = useState(0);
  const [highlightMode, setHighlightMode] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const isScrollingRef = useRef(false);
  const lastPageNumberRef = useRef(1);
  const lastContainerWidthRef = useRef(0);
  const pdfDocumentRef = useRef<PDFDocumentProxy | null>(null);

  const fileSource = (() => {
    const source = paper.file_path ? (() => {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
      const base = apiUrl.split('/api/v1')[0].replace(/\/$/, '') || 'http://localhost:8000';
      const filename = paper.file_path.split(/[/\\]/).pop() || '';
      return filename ? `${base}/storage/${filename}` : null;
    })() : (paper.url || null);

    console.log('[PDFViewer] Loading source:', source, {
      hasFilePath: !!paper.file_path,
      hasUrl: !!paper.url
    });
    return source;
  })();

  // ─── Handlers for toolbar actions ────────────────────────────────────────
  const handleReadingStatusChange = async (status: string) => {
    try {
      await papersApi.updateReadingStatus(paper.id, status as any);
      onAnnotationSuccess(); // trigger refetch
    } catch (err) {
      console.error('Failed to update reading status:', err);
    }
  };

  const handlePriorityChange = async (priority: string) => {
    try {
      await papersApi.updatePriority(paper.id, priority as any);
      onAnnotationSuccess(); // trigger refetch
    } catch (err) {
      console.error('Failed to update priority:', err);
    }
  };



  const handleBookmarkAdd = async () => {
    try {
      await papersApi.createBookmark(paper.id, pageNumber);
      onAnnotationSuccess(); // trigger refetch
    } catch (err) {
      console.error('Failed to add bookmark:', err);
    }
  };

  const handleDownload = () => {
    if (fileSource && typeof fileSource === 'string') {
      window.open(fileSource, '_blank');
    }
  };

  // ─── Scroll to page ───────────────────────────────────────────────────────
  const scrollToPage = useCallback((pageNum: number) => {
    if (pageNum < 1 || (numPages && pageNum > numPages)) return;

    const attemptScroll = (retryCount = 0) => {
      requestAnimationFrame(() => {
        const pageEl = pageRefs.current.get(pageNum);
        const scrollContainer = scrollContainerRef.current;
        if (pageEl && scrollContainer)
        {
          isScrollingRef.current = true;
          const containerRect = scrollContainer.getBoundingClientRect();
          const elementRect = pageEl.getBoundingClientRect();
          const scrollTop =
            scrollContainer.scrollTop +
            (elementRect.top - containerRect.top) -
            containerRect.height / 2 +
            elementRect.height / 2;

          scrollContainer.scrollTo({ top: Math.max(0, scrollTop), behavior: 'smooth' });
          setTimeout(() => { isScrollingRef.current = false; }, 1000);
        } else if (retryCount < 3)
        {
          setTimeout(() => attemptScroll(retryCount + 1), 150);
        } else
        {
          isScrollingRef.current = false;
        }
      });
    };

    attemptScroll();
  }, [numPages]);

  // ─── Auto-zoom from container width ──────────────────────────────────────
  const updateZoom = useCallback(() => {
    const container = containerRef.current;
    if (!container || !numPages || !firstPageDimensions) return;
    const containerWidth = container.clientWidth;
    if (containerWidth === 0) return;
    if (Math.abs(containerWidth - lastContainerWidthRef.current) < 10) return;
    lastContainerWidthRef.current = containerWidth;

    const available = containerWidth - 64; // padding
    const calculated = Math.max(0.5, Math.min(2.5, available / firstPageDimensions.width));
    setZoom(prev => Math.abs(prev - calculated) > 0.05 ? calculated : prev);
  }, [numPages, firstPageDimensions]);

  useEffect(() => {
    if (!containerRef.current || !numPages) return;
    updateZoom();
    let timeoutId: ReturnType<typeof setTimeout>;
    const observer = new ResizeObserver(() => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(updateZoom, 200);
    });
    observer.observe(containerRef.current);
    return () => { observer.disconnect(); clearTimeout(timeoutId); };
  }, [numPages, updateZoom]);

  // ─── Scroll tracking ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!scrollContainerRef.current || numPages === null) return;

    const handleScroll = () => {
      if (isScrollingRef.current) return;
      const container = scrollContainerRef.current;
      if (!container) return;

      const containerRect = container.getBoundingClientRect();
      const viewportCenter = containerRect.top + containerRect.height / 2;
      let current = 1;
      let minDist = Infinity;

      for (let i = 1; i <= numPages; i++)
      {
        const el = pageRefs.current.get(i);
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        const dist = Math.abs(viewportCenter - (rect.top + rect.height / 2));
        if (dist < minDist) { minDist = dist; current = i; }
      }

      if (current !== lastPageNumberRef.current)
      {
        lastPageNumberRef.current = current;
        setPageNumber(current);
        onCurrentPageChange?.(current);
      }
    };

    const container = scrollContainerRef.current;
    container.addEventListener('scroll', handleScroll, { passive: true });
    const timer = setTimeout(handleScroll, 100);
    return () => { clearTimeout(timer); container.removeEventListener('scroll', handleScroll); };
  }, [numPages, onCurrentPageChange]);

  // ─── Page load success ────────────────────────────────────────────────────
  const onPageLoadSuccess = useCallback((pageNum: number, page: { width: number; height: number }) => {
    setPageDimensions(prev => {
      const existing = prev.get(pageNum);
      if (existing && existing.width === page.width && existing.height === page.height) return prev;
      if (pageNum === 1) setFirstPageDimensions({ width: page.width, height: page.height });
      const next = new Map(prev);
      next.set(pageNum, { width: page.width, height: page.height });
      return next;
    });
  }, []);

  // Update rendered sizes when zoom changes
  useEffect(() => {
    const update = () => {
      const newSizes = new Map<number, { width: number; height: number }>();
      pageRefs.current.forEach((pageEl, pageNum) => {
        const canvas = pageEl.querySelector('canvas') as HTMLCanvasElement | null;
        if (canvas)
        {
          const rect = canvas.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0)
          {
            newSizes.set(pageNum, { width: rect.width, height: rect.height });
          }
        }
      });
      if (newSizes.size > 0) setRenderedPageSizes(newSizes);
    };
    const timer = setTimeout(update, 150);
    return () => clearTimeout(timer);
  }, [zoom, numPages]);

  // ─── TOC extraction ───────────────────────────────────────────────────────
  const extractTOC = useCallback(async (pdf: PDFDocumentProxy) => {
    try
    {
      if (typeof (pdf as any).getOutline !== 'function') return;
      await new Promise(r => setTimeout(r, 100));
      const outline = await (pdf as any).getOutline();
      if (!outline || !Array.isArray(outline) || outline.length === 0) return;

      const processOutline = async (items: any[]): Promise<TOCItem[]> => {
        const processed: TOCItem[] = [];
        for (const item of items)
        {
          let pageNum = 1;
          if (item.dest || item.url)
          {
            try
            {
              let dest = item.dest || item.url;
              let resolvedDest: any = null;

              if (typeof dest === 'string')
              {
                if (typeof (pdf as any).getDestination === 'function')
                {
                  resolvedDest = await (pdf as any).getDestination(dest);
                }
              } else if (Array.isArray(dest) && dest.length > 0 && typeof dest[0] === 'string')
              {
                if (typeof (pdf as any).getDestination === 'function')
                {
                  resolvedDest = await (pdf as any).getDestination(dest);
                }
              } else if (Array.isArray(dest))
              {
                resolvedDest = dest;
              } else if (dest && typeof dest === 'object')
              {
                resolvedDest = dest;
              }

              let pageRef: any = null;
              if (Array.isArray(resolvedDest) && resolvedDest.length > 0)
              {
                pageRef = resolvedDest[0];
              } else if (resolvedDest && typeof resolvedDest === 'object' && !Array.isArray(resolvedDest))
              {
                pageRef = resolvedDest;
              } else if (dest && typeof dest === 'object' && !Array.isArray(dest))
              {
                pageRef = dest;
              }

              if (pageRef && typeof (pdf as any).getPageIndex === 'function')
              {
                try
                {
                  const idx = await (pdf as any).getPageIndex(pageRef);
                  if (idx !== null && idx !== undefined && !isNaN(idx) && idx >= 0 && idx < pdf.numPages)
                  {
                    pageNum = Math.floor(idx) + 1;
                  }
                } catch
                {
                  if (pageRef && typeof pageRef === 'object' && 'num' in pageRef && typeof pageRef.num === 'number')
                  {
                    const n = pageRef.num;
                    if (n >= 1 && n <= pdf.numPages) pageNum = Math.floor(n);
                    else if (n >= 0 && n < pdf.numPages) pageNum = Math.floor(n) + 1;
                  }
                }
              } else if (typeof pageRef === 'number' && pageRef > 0)
              {
                if (pageRef >= 1 && pageRef <= pdf.numPages) pageNum = Math.floor(pageRef);
                else if (pageRef < pdf.numPages) pageNum = Math.floor(pageRef) + 1;
              }
            } catch { /* keep pageNum = 1 */ }
          }

          if (pageNum < 1 || pageNum > pdf.numPages) pageNum = 1;

          processed.push({
            title: item.title || 'Untitled',
            page: pageNum,
            items: item.items && Array.isArray(item.items) && item.items.length > 0
              ? await processOutline(item.items)
              : undefined,
          });
        }
        return processed;
      };

      setTocItems(await processOutline(outline));
    } catch
    {
      setTocItems(null);
    }
  }, []);

  const onDocumentLoadSuccess = useCallback((pdf: PDFDocumentProxy) => {
    pdfDocumentRef.current = pdf;
    setNumPages(pdf.numPages);
    extractTOC(pdf).catch(() => { });
  }, [extractTOC]);

  // ─── TOC item click ───────────────────────────────────────────────────────
  const handleTOCItemClick = useCallback((page: number) => {
    if (page < 1 || (numPages && page > numPages)) return;
    setShowTOC(false);
    setPageNumber(page);
    onCurrentPageChange?.(page);
    setTimeout(() => {
      requestAnimationFrame(() => requestAnimationFrame(() => scrollToPage(page)));
    }, 50);
  }, [numPages, onCurrentPageChange, scrollToPage]);

  // ─── Toolbar page change ──────────────────────────────────────────────────
  const handlePageChange = useCallback((page: number) => {
    setPageNumber(page);
    onCurrentPageChange?.(page);
    scrollToPage(page);
  }, [onCurrentPageChange, scrollToPage]);

  // ─── Text selection → annotation form ────────────────────────────────────
  const handleMouseUp = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0)
    {
      setFloatingFormData(null);
      return;
    }

    const range = selection.getRangeAt(0);
    const selectedText = range.toString().trim();
    if (!selectedText) return;

    // Find which page contains the selection
    let selectedPage: number | null = null;
    let pageElement: HTMLElement | null = null;
    for (let i = 1; i <= (numPages || 0); i++)
    {
      const el = pageRefs.current.get(i);
      if (el && el.contains(range.commonAncestorContainer))
      {
        selectedPage = i;
        pageElement = el;
        break;
      }
    }
    if (!selectedPage || !pageElement) return;

    const pdfCanvas = pageElement.querySelector('canvas') as HTMLElement | null;
    const referenceEl = pdfCanvas || pageElement;
    const pageRect = referenceEl.getBoundingClientRect();
    const selectionRect = range.getBoundingClientRect();

    const startX = Math.max(0, Math.min(1, (selectionRect.left - pageRect.left) / pageRect.width));
    const startY = Math.max(0, Math.min(1, (selectionRect.top - pageRect.top) / pageRect.height));
    const endX = Math.max(0, Math.min(1, (selectionRect.right - pageRect.left) / pageRect.width));
    const endY = Math.max(0, Math.min(1, (selectionRect.bottom - pageRect.top) / pageRect.height));

    const selectionData = {
      start: { x: startX, y: startY },
      end: { x: endX, y: endY },
      boundingBox: {
        left: Math.min(startX, endX),
        top: Math.min(startY, endY),
        right: Math.max(startX, endX),
        bottom: Math.max(startY, endY),
        width: Math.abs(endX - startX),
        height: Math.abs(endY - startY),
      },
    };

    setFloatingFormData({
      coordinates: { page: selectedPage, x: (startX + endX) / 2, y: (startY + endY) / 2 },
      position: {
        x: (selectionRect.left + selectionRect.right) / 2,
        y: selectionRect.bottom + 10,
      },
      highlightedText: selectedText,
      selectionData,
    });

    selection.removeAllRanges();
  }, [numPages]);

  // ─── Dark mode ────────────────────────────────────────────────────────────
  const { isDarkMode, pageRegions, darkPageFlags, analyzePageForImages } = usePDFDarkMode();

  // ─── Annotation helpers ───────────────────────────────────────────────────
  const getAnnotationPage = (ann: Annotation): number | null => {
    const coord = ann.coordinate_data as { page?: number } | null;
    return coord?.page ?? null;
  };

  const getAnnotationPosition = (ann: Annotation): { x: number; y: number } | null => {
    const coord = ann.coordinate_data as { x?: number; y?: number } | null;
    if (coord?.x !== undefined && coord?.y !== undefined) return { x: coord.x, y: coord.y };
    return null;
  };

  const getHighlightBBox = (ann: Annotation) =>
    (ann as any).selection_data?.boundingBox ?? null;

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      className="flex h-full w-full overflow-hidden bg-[#f1f1f1] dark:bg-[#101111]"
    >
      {/* TOC drawer */}
      {showTOC && (
        <div className="w-72 shrink-0 border-r border-[var(--border)] flex flex-col overflow-hidden">
          <PDFTOC
            items={tocItems}
            onItemClick={handleTOCItemClick}
            currentPage={pageNumber}
            onClose={() => setShowTOC(false)}
          />
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <PDFToolbar
          zoom={zoom}
          onZoomChange={setZoom}
          currentPage={pageNumber}
          numPages={numPages}
          onPageChange={handlePageChange}
          onFirstPage={() => handlePageChange(1)}
          onLastPage={() => handlePageChange(numPages || 1)}
          onPreviousPage={() => handlePageChange(Math.max(1, pageNumber - 1))}
          onNextPage={() => handlePageChange(Math.min(numPages || 1, pageNumber + 1))}
          showTOC={showTOC}
          onTOCToggle={() => setShowTOC(v => !v)}
          rotation={rotation}
          onRotationChange={setRotation}
          highlightMode={highlightMode}
          onHighlightModeToggle={() => {
            setHighlightMode(!highlightMode);
          }}
          paperId={paper.id}
          readingStatus={paper.reading_status}
          onReadingStatusChange={handleReadingStatusChange}
          priority={paper.priority}
          onPriorityChange={handlePriorityChange}
          onBookmarkAdd={handleBookmarkAdd}
          onDownload={handleDownload}
          onNoteAction={onNoteAction}
        />

        {!fileSource ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center text-[var(--muted-foreground)] opacity-50">
            <p className="text-body font-medium">No file attached to this paper</p>
          </div>
        ) : (
          <div
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto scrollbar-none py-0 flex flex-col items-center gap-0"
            onMouseUp={handleMouseUp}
          >
            <Document
              file={fileSource}
              options={PDF_OPTIONS}
              onLoadSuccess={onDocumentLoadSuccess as any}
              onLoadError={(error) => {
                console.error('[PDFViewer] Document load error:', error);
              }}
              loading={
                <div className="text-code opacity-50 py-12 font-medium">Loading document…</div>
              }
              error={
                <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
                  <div className="p-3 rounded-full bg-[var(--destructive)]/10 text-[var(--destructive)] mb-4">
                    <AlertCircle size={24} />
                  </div>
                  <h3 className="text-body font-semibold text-[var(--foreground)] mb-1">Failed to load PDF</h3>
                  <p className="text-caption text-[var(--muted-foreground)] max-w-[17.5rem] mb-6">
                    Check that the file is accessible or try downloading it directly.
                  </p>
                  <div className="flex gap-3">
                    <Button
                      variant="outlined"
                      size="sm"
                      onClick={() => window.location.reload()}
                    >
                      Retry
                    </Button>
                    {fileSource && typeof fileSource === 'string' && (
                      <a
                        href={fileSource}
                        download
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center rounded-md text-caption font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--border)] disabled:pointer-events-none disabled:opacity-50 bg-[var(--foreground)] text-[var(--white)] hover:bg-[var(--foreground)]/90 h-8 px-3"
                      >
                        Download PDF
                      </a>
                    )}
                  </div>
                </div>
              }
              className="flex flex-col items-center gap-0"
            >
              {Array.from({ length: numPages || 0 }, (_, i) => i + 1).map((page) => {
                const pageDims = pageDimensions.get(page);
                const renderedSize = renderedPageSizes.get(page);
                const renderedW = renderedSize?.width ?? (pageDims ? pageDims.width * zoom : 0);
                const renderedH = renderedSize?.height ?? (pageDims ? pageDims.height * zoom : 0);

                const pageHighlights = annotations.filter(
                  ann => getAnnotationPage(ann) === page && (ann as any).selection_data?.boundingBox
                );
                const pageMarkers = annotations.filter(
                  ann => getAnnotationPage(ann) === page && ann.type !== 'note' && !((ann as any).selection_data?.boundingBox)
                );

                return (
                  <div
                    key={page}
                    ref={el => { if (el) pageRefs.current.set(page, el); }}
                    className="relative flex justify-center rounded-sm"
                    style={isDarkMode && !darkPageFlags[page] ? { filter: 'invert(0.86) hue-rotate(180deg)' } : undefined}
                  >
                    <div className="relative">
                      <Page
                        pageNumber={page}
                        scale={zoom}
                        rotate={rotation}
                        renderTextLayer={true}
                        renderAnnotationLayer={true}
                        onLoadSuccess={p => onPageLoadSuccess(page, p)}
                        onRenderSuccess={() => {
                          const el = pageRefs.current.get(page);
                          // Note: getPage is async in PDF.js but react-pdf might have it cached.
                          // We'll pass it if we can, else analyzer falls back to OCR.
                          if (el)
                          {
                            pdfDocumentRef.current?.getPage(page).then(p => {
                              analyzePageForImages(el, page, p);
                            }).catch(() => {
                              analyzePageForImages(el, page);
                            });
                          }
                        }}
                      />

                      {/* Highlight overlays */}
                      {pageDims && pageHighlights.length > 0 && renderedW > 0 && (
                        <div
                          className="absolute pointer-events-none"
                          style={{ top: 0, left: 0, width: renderedW, height: renderedH, zIndex: 1 }}
                        >
                          {pageHighlights.map(ann => {
                            const bbox = getHighlightBBox(ann);
                            if (!bbox) return null;
                            return (
                              <div
                                key={ann.id}
                                className="absolute group"
                                style={{
                                  left: bbox.left * renderedW,
                                  top: bbox.top * renderedH,
                                  width: Math.max(2, bbox.width * renderedW),
                                  height: Math.max(2, bbox.height * renderedH),
                                  backgroundColor: 'rgba(255,220,0,0.35)',
                                  border: '1px solid rgba(200,170,0,0.5)',
                                  borderRadius: 2,
                                  mixBlendMode: 'multiply',
                                  pointerEvents: 'auto',
                                  cursor: 'pointer',
                                }}
                                title={ann.highlighted_text || ann.content}
                              />
                            );
                          })}
                        </div>
                      )}

                      {/* Annotation dot markers */}
                      {pageDims && pageMarkers.length > 0 && (
                        <div className="absolute inset-0 pointer-events-none">
                          {pageMarkers.map(ann => {
                            const pos = getAnnotationPosition(ann);
                            if (!pos) return null;
                            return (
                              <div
                                key={ann.id}
                                className="absolute pointer-events-auto"
                                style={{
                                  left: pos.x * (pageDims.width * zoom),
                                  top: pos.y * (pageDims.height * zoom),
                                  transform: 'translate(-50%,-50%)',
                                }}
                                title={ann.content}
                              >
                                <div className="w-3.5 h-3.5 bg-[var(--sky-blue)] border-2 border-[var(--white)] rounded-full shadow-subtle cursor-pointer hover:scale-125 transition-transform" />
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Dark mode image overlays (double-invert to restore original colours) */}
                      {isDarkMode && (pageRegions[page] ?? []).map((region, idx) => (
                        <div
                          key={idx}
                          className="absolute pointer-events-none overflow-hidden"
                          style={{
                            left: `${(region.x0 / region.canvasWidth) * 100}%`,
                            top: `${(region.y0 / region.canvasHeight) * 100}%`,
                            width: `${((region.x1 - region.x0) / region.canvasWidth) * 100}%`,
                            height: `${((region.y1 - region.y0) / region.canvasHeight) * 100}%`,
                            filter: 'invert(1) hue-rotate(180deg)',
                            zIndex: 2,
                          }}
                        >
                          <img
                            src={region.dataUrl}
                            alt=""
                            className="w-full h-full object-fill"
                            draggable={false}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </Document>
          </div>
        )}
      </div>

      {/* Floating annotation form */}
      {floatingFormData && (
        <FloatingAnnotationForm
          paperId={paper.id}
          coordinateData={floatingFormData.coordinates}
          position={floatingFormData.position}
          highlightedText={floatingFormData.highlightedText}
          selectionData={floatingFormData.selectionData}
          onCancel={() => setFloatingFormData(null)}
          onSuccess={() => {
            setFloatingFormData(null);
            onAnnotationSuccess();
          }}
        />
      )}
    </div>
  );
}

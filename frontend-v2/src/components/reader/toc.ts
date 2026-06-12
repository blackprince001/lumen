import type { PDFDocumentProxy } from 'pdfjs-dist';

export interface TOCItem {
  title: string;
  page: number;
  items?: TOCItem[];
}

/* Ported from the legacy PDFViewer: resolve outline destinations to pages. */
/* eslint-disable @typescript-eslint/no-explicit-any */
export async function extractTOC(pdf: PDFDocumentProxy): Promise<TOCItem[] | null> {
  try {
    if (typeof (pdf as any).getOutline !== 'function') return null;
    await new Promise((r) => setTimeout(r, 100));
    const outline = await (pdf as any).getOutline();
    if (!outline || !Array.isArray(outline) || outline.length === 0) return null;

    const processOutline = async (items: any[]): Promise<TOCItem[]> => {
      const processed: TOCItem[] = [];
      for (const item of items) {
        let pageNum = 1;
        if (item.dest || item.url) {
          try {
            const dest = item.dest || item.url;
            let resolvedDest: any = null;

            if (typeof dest === 'string') {
              if (typeof (pdf as any).getDestination === 'function') {
                resolvedDest = await (pdf as any).getDestination(dest);
              }
            } else if (Array.isArray(dest) && dest.length > 0 && typeof dest[0] === 'string') {
              if (typeof (pdf as any).getDestination === 'function') {
                resolvedDest = await (pdf as any).getDestination(dest);
              }
            } else if (Array.isArray(dest)) {
              resolvedDest = dest;
            } else if (dest && typeof dest === 'object') {
              resolvedDest = dest;
            }

            let pageRef: any = null;
            if (Array.isArray(resolvedDest) && resolvedDest.length > 0) {
              pageRef = resolvedDest[0];
            } else if (resolvedDest && typeof resolvedDest === 'object' && !Array.isArray(resolvedDest)) {
              pageRef = resolvedDest;
            } else if (dest && typeof dest === 'object' && !Array.isArray(dest)) {
              pageRef = dest;
            }

            if (pageRef && typeof (pdf as any).getPageIndex === 'function') {
              try {
                const idx = await (pdf as any).getPageIndex(pageRef);
                if (idx !== null && idx !== undefined && !isNaN(idx) && idx >= 0 && idx < pdf.numPages) {
                  pageNum = Math.floor(idx) + 1;
                }
              } catch {
                if (pageRef && typeof pageRef === 'object' && 'num' in pageRef && typeof pageRef.num === 'number') {
                  const n = pageRef.num;
                  if (n >= 1 && n <= pdf.numPages) pageNum = Math.floor(n);
                  else if (n >= 0 && n < pdf.numPages) pageNum = Math.floor(n) + 1;
                }
              }
            } else if (typeof pageRef === 'number' && pageRef > 0) {
              if (pageRef >= 1 && pageRef <= pdf.numPages) pageNum = Math.floor(pageRef);
              else if (pageRef < pdf.numPages) pageNum = Math.floor(pageRef) + 1;
            }
          } catch {
            /* keep pageNum = 1 */
          }
        }

        if (pageNum < 1 || pageNum > pdf.numPages) pageNum = 1;

        processed.push({
          title: item.title || 'Untitled',
          page: pageNum,
          items:
            item.items && Array.isArray(item.items) && item.items.length > 0
              ? await processOutline(item.items)
              : undefined,
        });
      }
      return processed;
    };

    return await processOutline(outline);
  } catch {
    return null;
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

import { fetchApi } from '@/lib/api/client';
import type { FileSystemFileItem } from '@/components/shadcn/file-system';
import type { PaperFileMetadata } from './manifest';

/**
 * Client-side PDF cover thumbnails for the Finder.
 *
 * Pages are rendered lazily with pdfjs (same instance the reader uses) and
 * cached two ways: a module-level promise map for the session, and Cache
 * Storage for persistence across visits (keyed by paper id + updated_at so
 * re-uploads invalidate naturally).
 */

const THUMB_WIDTH = 320;
const MAX_CONCURRENT = 3;
const CACHE_NAME = 'paper-thumbs-v1';

const inflight = new Map<string, Promise<string | null>>();
const queue: Array<() => void> = [];
let running = 0;

function withConcurrencyLimit<T>(task: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const run = () => {
      running++;
      task()
        .then(resolve, reject)
        .finally(() => {
          running--;
          queue.shift()?.();
        });
    };
    if (running < MAX_CONCURRENT) run();
    else queue.push(run);
  });
}

async function cacheGet(key: string): Promise<string | null> {
  try {
    const cache = await caches.open(CACHE_NAME);
    const hit = await cache.match(key);
    if (!hit) return null;
    return URL.createObjectURL(await hit.blob());
  } catch {
    return null;
  }
}

async function cachePut(key: string, blob: Blob): Promise<void> {
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(key, new Response(blob, { headers: { 'Content-Type': 'image/png' } }));
  } catch {
    // Cache Storage unavailable (private mode etc.) — thumbnails stay session-only.
  }
}

async function renderPage(fileUrl: string, pageIndex: number): Promise<Blob | null> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString();

  const pdfBlob = await fetchApi<Blob>(fileUrl, { method: 'GET', responseType: 'blob' });
  const doc = await pdfjs.getDocument({
    data: await pdfBlob.arrayBuffer(),
    cMapPacked: true,
    cMapUrl: '/pdfjs/cmaps/',
    standardFontDataUrl: '/pdfjs/standard_fonts/',
  }).promise;

  try {
    if (pageIndex >= doc.numPages) return null;
    const page = await doc.getPage(pageIndex + 1);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: THUMB_WIDTH / base.width });

    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    await page.render({ canvas, canvasContext: ctx, viewport }).promise;

    return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  } finally {
    void doc.destroy();
  }
}

/** `loadPreviewImageUrl` prop for the FileSystem component. */
export async function loadPaperThumbnail(
  file: FileSystemFileItem,
  pageIndex: number
): Promise<string | null> {
  const meta = file.metadata as unknown as PaperFileMetadata | undefined;
  if (!meta?.paperId || !file.url) return null;

  const key = `/thumbs/p${meta.paperId}/${pageIndex}?v=${encodeURIComponent(file.updatedAt ?? '')}`;
  const existing = inflight.get(key);
  if (existing) return existing;

  const promise = (async () => {
    const cached = await cacheGet(key);
    if (cached) return cached;

    const blob = await withConcurrencyLimit(() => renderPage(file.url!, pageIndex));
    if (!blob) return null;
    void cachePut(key, blob);
    return URL.createObjectURL(blob);
  })().catch(() => {
    inflight.delete(key);
    return null;
  });

  inflight.set(key, promise);
  return promise;
}

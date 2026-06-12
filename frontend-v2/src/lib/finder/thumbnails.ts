import { fetchApi } from '@/lib/api/client';
import { renderPdfCover } from '@/lib/pdf-cover';
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

function getThemeBg(): string {
  if (typeof document === 'undefined') return '#ffffff';
  return document.documentElement.classList.contains('dark') ? '#1a1a2e' : '#ffffff';
}

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

async function renderPage(fileUrl: string, pageIndex: number, bgColor: string): Promise<Blob | null> {
  const pdfBlob = await fetchApi<Blob>(fileUrl, { method: 'GET', responseType: 'blob' });
  return renderPdfCover(await pdfBlob.arrayBuffer(), pageIndex, THUMB_WIDTH, bgColor);
}

/**
 * Cached cover/page thumbnail for a paper. Shared by the Finder, paper
 * cards, and anything else that knows a paper id + file URL.
 */
export async function loadPaperCover(
  paperId: number,
  fileUrl: string,
  updatedAt?: string,
  pageIndex = 0
): Promise<string | null> {
  const bgColor = getThemeBg();
  const key = `/thumbs/p${paperId}/${pageIndex}?bg=${encodeURIComponent(bgColor)}&v=${encodeURIComponent(updatedAt ?? '')}`;
  const existing = inflight.get(key);
  if (existing) return existing;

  const promise = (async () => {
    const cached = await cacheGet(key);
    if (cached) return cached;

    const blob = await withConcurrencyLimit(() => renderPage(fileUrl, pageIndex, bgColor));
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

/** `loadPreviewImageUrl` prop for the FileSystem component. */
export async function loadPaperThumbnail(
  file: FileSystemFileItem,
  pageIndex: number
): Promise<string | null> {
  const meta = file.metadata as unknown as PaperFileMetadata | undefined;
  if (!meta?.paperId || !file.url) return null;
  return loadPaperCover(meta.paperId, file.url, file.updatedAt, pageIndex);
}

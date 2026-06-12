import { useQuery } from '@tanstack/react-query';
import { loadPaperCover } from '@/lib/finder/thumbnails';
import type { Paper } from '@/lib/api/papers';

/**
 * First-page cover for a paper, lazily rendered with pdfjs and shared with
 * the Finder's Cache Storage cache. Returns null while loading / unavailable.
 */
export function usePaperThumbnail(paper: Paper): string | null {
  const { data } = useQuery({
    queryKey: ['paper-thumb', paper.id, paper.updated_at],
    queryFn: () => loadPaperCover(paper.id, paper.file_url!, paper.updated_at),
    enabled: Boolean(paper.file_url),
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  });
  return data ?? null;
}

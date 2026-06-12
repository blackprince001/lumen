import { useQuery } from '@tanstack/react-query';
import { loadPaperCover } from '@/lib/finder/thumbnails';
import { useTheme } from '@/lib/theme';
import type { Paper } from '@/lib/api/papers';

/**
 * First-page cover for a paper, lazily rendered with pdfjs and shared with
 * the Finder's Cache Storage cache. Re-fetches on theme switch so the
 * thumbnail background matches the current color scheme.
 */
export function usePaperThumbnail(paper: Paper): string | null {
  const { theme } = useTheme();
  const { data } = useQuery({
    queryKey: ['paper-thumb', paper.id, paper.updated_at, theme],
    queryFn: () => loadPaperCover(paper.id, paper.file_url!, paper.updated_at),
    enabled: Boolean(paper.file_url),
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  });
  return data ?? null;
}

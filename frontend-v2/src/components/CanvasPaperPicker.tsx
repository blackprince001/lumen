import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { SearchNormal as Search, TickCircle } from 'iconsax-reactjs';
import { papersApi, type Paper } from '@/lib/api/papers';
import { citationCanvasApi } from '@/lib/api/citationCanvas';
import { DRAG_SOURCE_MIME } from './CitationCanvas';
import { cn } from '@/lib/utils';

interface CanvasPaperPickerProps {
  className?: string;
}

export function CanvasPaperPicker({ className }: CanvasPaperPickerProps) {
  const [query, setQuery] = useState('');

  const { data: papersData, isLoading } = useQuery({
    queryKey: ['papers', 1, 100, query],
    queryFn: () => papersApi.list(1, 100, query || undefined),
  });

  const { data: canvasData } = useQuery({
    queryKey: ['citation-canvas'],
    queryFn: () => citationCanvasApi.get(),
  });

  const onCanvasIds = useMemo(
    () => new Set(canvasData?.items.map((i) => i.paper_id) ?? []),
    [canvasData]
  );

  const papers: Paper[] = papersData?.papers ?? [];

  const handleDragStart = (e: React.DragEvent, paperId: number) => {
    e.dataTransfer.setData(DRAG_SOURCE_MIME, String(paperId));
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div className={cn('flex flex-col border-r border-[var(--border)] bg-[var(--card)]', className)}>
      <div className="p-3 border-b border-[var(--border)]">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search library..."
            className="w-full pl-8 pr-3 h-8 text-caption bg-[var(--background)] border border-[var(--border)] rounded-lg text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:border-[var(--foreground)] transition-colors"
          />
        </div>
        <p className="text-caption text-[var(--muted-foreground)] mt-2">
          Drag papers onto the canvas
        </p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-3 text-caption text-[var(--muted-foreground)]">Loading…</div>
        ) : papers.length === 0 ? (
          <div className="p-3 text-caption text-[var(--muted-foreground)]">
            {query ? `No papers matching "${query}"` : 'No papers in library'}
          </div>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {papers.map((paper) => {
              const onCanvas = onCanvasIds.has(paper.id);
              const author = (paper.metadata_json?.author as string | undefined) ??
                (paper.metadata_json?.authors as string | undefined);

              return (
                <li
                  key={paper.id}
                  draggable={!onCanvas}
                  onDragStart={(e) => handleDragStart(e, paper.id)}
                  className={cn(
                    'px-3 py-2 group transition-colors',
                    onCanvas
                      ? 'opacity-50 cursor-not-allowed'
                      : 'cursor-grab active:cursor-grabbing hover:bg-[var(--muted)]'
                  )}
                  title={onCanvas ? 'Already on canvas' : 'Drag to canvas'}
                >
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-caption font-medium text-[var(--foreground)] line-clamp-2 leading-snug">
                        {paper.title}
                      </p>
                      {author && (
                        <p className="text-caption text-[var(--muted-foreground)] mt-0.5 line-clamp-1">
                          {author}
                        </p>
                      )}
                    </div>
                    {onCanvas && (
                      <TickCircle size={14} className="shrink-0 mt-0.5 text-[var(--muted-foreground)]" />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

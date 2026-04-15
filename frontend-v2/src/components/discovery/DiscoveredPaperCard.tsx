import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Bookmark2 as BookmarkPlus, TickCircle as Check, Refresh as Loader2, ExportSquare as ExternalLink } from 'iconsax-reactjs';
import { papersApi } from '@/lib/api/papers';
import type { DiscoveredPaperPreview } from '@/lib/api/discovery';
import { toastSuccess, toastError } from '@/lib/utils/toast';
import { cn } from '@/lib/utils';
import { getPaperTheme } from '@/lib/paper-themes';

interface DiscoveredPaperCardProps {
  paper: DiscoveredPaperPreview;
  showCheckbox?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
  index?: number;
}

export function DiscoveredPaperCard({ 
  paper, 
  showCheckbox = false, 
  isSelected = false, 
  onToggleSelect,
  index: _index = 0,
}: DiscoveredPaperCardProps) {
  const [isAdded, setIsAdded] = useState(false);
  const queryClient = useQueryClient();
  
  // Use a hash of the title for consistent theming
  const titleHash = paper.title.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const theme = getPaperTheme(titleHash);

  const addToLibraryMutation = useMutation({
    mutationFn: async () => {
      const url = paper.pdf_url || paper.url;
      if (!url) {
        throw new Error('No URL available for this paper');
      }

      if (!paper.pdf_url && paper.source === 'semantic_scholar') {
        throw new Error('No PDF available. Try finding the paper on arXiv or the publisher website.');
      }

      return papersApi.ingestBatch([url]);
    },
    onSuccess: () => {
      setIsAdded(true);
      toastSuccess('Paper added to library');
      queryClient.invalidateQueries({ queryKey: ['papers'] });
    },
    onError: (error: Error) => {
      toastError(error.message || 'Failed to add paper');
    },
  });

  const handleClick = showCheckbox && onToggleSelect ? onToggleSelect : undefined;

  return (
    <div
      className={cn(
        'group relative h-full rounded-2xl border p-5 overflow-hidden',
        'transition-all duration-200 hover:border-[var(--foreground)]',
        isSelected && 'ring-2 ring-[var(--foreground)]',
        showCheckbox && 'cursor-pointer',
      )}
      style={{ backgroundColor: theme.bg, borderColor: isSelected ? undefined : theme.border }}
      onClick={handleClick}
    >
      {/* Top row: checkbox + source badge + year + add button */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          {/* Selection checkbox */}
          {showCheckbox && (
            <div className={cn(
              'w-4 h-4 rounded border-2 flex items-center justify-center transition-colors shrink-0',
              isSelected
                ? 'bg-[var(--foreground)] border-[var(--foreground)]'
                : 'bg-transparent border-[var(--mid-gray)]',
            )}>
              {isSelected && (
                <svg className="w-2.5 h-2.5 text-[var(--background)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
          )}

          {/* Source badge */}
          <span 
            className="px-2 py-0.5 rounded text-micro font-bold uppercase tracking-wider"
            style={{ backgroundColor: theme.accent, color: theme.text }}
          >
            {paper.source}
          </span>
        </div>

        {/* Year + Add button */}
        <div className="flex items-center gap-2 shrink-0">
          {paper.year && (
            <span className="text-caption font-semibold opacity-60" style={{ color: theme.text }}>
              {paper.year}
            </span>
          )}
          <a
            href={paper.url || paper.pdf_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className={cn(
              'p-1.5 rounded-lg transition-all',
              'opacity-0 group-hover:opacity-100 hover:bg-black/10'
            )}
            style={{ color: theme.text }}
            title="Open original"
          >
            <ExternalLink size={14} />
          </a>
          <button
            onClick={(e) => {
              e.stopPropagation();
              addToLibraryMutation.mutate();
            }}
            disabled={addToLibraryMutation.isPending || isAdded}
            className={cn(
              'p-1.5 rounded-lg transition-all',
              isAdded 
                ? 'opacity-100' 
                : 'opacity-0 group-hover:opacity-100 hover:bg-black/10'
            )}
            style={{ color: theme.text }}
            title={isAdded ? 'Added to library' : 'Add to library'}
          >
            {addToLibraryMutation.isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : isAdded ? (
              <Check size={14} className="text-green-600" />
            ) : (
              <BookmarkPlus size={14} />
            )}
          </button>
        </div>
      </div>

      {/* Title */}
      <h3 
        className="text-btn font-bold leading-snug mb-2 line-clamp-2"
        style={{ color: theme.text }}
      >
        {paper.title}
      </h3>

      {/* Authors */}
      {paper.authors && paper.authors.length > 0 && (
        <p 
          className="text-caption mb-2 opacity-75 line-clamp-1"
          style={{ color: theme.text }}
        >
          {paper.authors.slice(0, 3).join(', ')}
          {paper.authors.length > 3 && ` +${paper.authors.length - 3} more`}
        </p>
      )}

      {/* Abstract */}
      {paper.abstract && (
        <p 
          className="text-code leading-relaxed line-clamp-2 mb-3 opacity-70"
          style={{ color: theme.text }}
        >
          {paper.abstract}
        </p>
      )}

      {/* Bottom metadata */}
      <div className="flex items-center gap-3 text-caption opacity-60" style={{ color: theme.text }}>
        {paper.citation_count !== undefined && <span>{paper.citation_count} citations</span>}
        {paper.relevance_score !== undefined && (
          <span className="font-semibold opacity-100">
            {Math.round(paper.relevance_score * 100)}% relevant
          </span>
        )}
      </div>
    </div>
  );
}

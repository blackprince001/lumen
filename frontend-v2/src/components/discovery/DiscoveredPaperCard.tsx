import { useState } from 'react';
import { Bookmark2 as BookmarkPlus, ExportSquare as ExternalLink } from 'iconsax-reactjs';
import type { DiscoveredPaperPreview } from '@/lib/api/discovery';
import { AddToLibraryDialog } from './AddToLibraryDialog';
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
  const [showDialog, setShowDialog] = useState(false);

  const titleHash = paper.title.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const theme = getPaperTheme(titleHash);

  const handleClick = showCheckbox && onToggleSelect ? onToggleSelect : undefined;

  return (
    <>
      <div
        className={cn(
          'group relative h-full rounded-2xl border overflow-hidden paper-card-hover flex flex-col',
          isSelected && 'ring-2 ring-[var(--foreground)]',
          showCheckbox && 'cursor-pointer',
        )}
        style={{ backgroundColor: theme.bg, borderColor: isSelected ? undefined : theme.border, '--card-action': theme.action } as React.CSSProperties}
        onClick={handleClick}
      >
        {/* Header: checkbox + source badge + year + actions */}
        <div className="flex items-start justify-between gap-2 px-4 pt-3.5 pb-2.5">
          <div className="flex items-center gap-2">
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
            <span
              className="px-2 py-0.5 rounded text-micro font-bold uppercase tracking-wider"
              style={{ backgroundColor: theme.accent, color: theme.text }}
            >
              {paper.source}
            </span>
          </div>

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
              className={cn('p-1.5 rounded-lg transition-all opacity-0 group-hover:opacity-100 hover:bg-black/10')}
              style={{ color: theme.text }}
              title="Open original"
            >
              <ExternalLink size={14} />
            </a>
            <button
              onClick={(e) => { e.stopPropagation(); setShowDialog(true); }}
              className="p-1.5 rounded-lg transition-all opacity-0 group-hover:opacity-100 hover:bg-black/10"
              style={{ color: theme.text }}
              title="Add to library"
            >
              <BookmarkPlus size={14} />
            </button>
          </div>
        </div>

        {/* Inset content area */}
        <div
          className="rounded-t-xl border-t px-4 pt-3.5 pb-4 flex-1"
          style={{ backgroundColor: theme.accent, borderColor: theme.border }}
        >
          <h3 className="text-btn font-bold leading-snug mb-2 line-clamp-2" style={{ color: theme.text }}>
            {paper.title}
          </h3>

          {paper.authors && paper.authors.length > 0 && (
            <p className="text-caption mb-2 opacity-75 line-clamp-1" style={{ color: theme.text }}>
              {paper.authors.slice(0, 3).join(', ')}
              {paper.authors.length > 3 && ` +${paper.authors.length - 3} more`}
            </p>
          )}

          {paper.abstract && (
            <p className="text-code leading-relaxed line-clamp-2 mb-3 opacity-70" style={{ color: theme.text }}>
              {paper.abstract}
            </p>
          )}

          <div className="flex items-center gap-3 text-caption opacity-60" style={{ color: theme.text }}>
            {paper.citation_count !== undefined && <span>{paper.citation_count} citations</span>}
            {paper.relevance_score !== undefined && (
              <span className="font-semibold opacity-100">
                {Math.round(paper.relevance_score * 100)}% relevant
              </span>
            )}
          </div>
        </div>
      </div>

      {showDialog && (
        <AddToLibraryDialog paper={paper} onClose={() => setShowDialog(false)} />
      )}
    </>
  );
}

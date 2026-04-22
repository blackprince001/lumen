import { Link } from 'react-router-dom';
import { ExportSquare as ExternalLink, Trash as Trash2, People } from 'iconsax-reactjs';
import { cn } from '@/lib/utils';
import { getPaperTheme } from '@/lib/paper-themes';
import { ReadingStatusBadge } from '@/components/ReadingStatusBadge';
import { PriorityBadge } from '@/components/PriorityBadge';
import { ProcessingStatusBadge } from '@/components/ProcessingStatusBadge';
import type { Paper } from '@/lib/api/papers';

interface PaperCardProps {
  paper: Paper;
  onDelete?: (id: number) => void;
  selectionMode?: boolean;
  selected?: boolean;
  onSelect?: (id: number) => void;
  /** Index is no longer used (no stagger animation) — kept for API compatibility */
  index?: number;
}

export function PaperCard({
  paper,
  onDelete,
  selectionMode = false,
  selected = false,
  onSelect,
}: PaperCardProps) {
  const theme = getPaperTheme(paper.id);
  const isShared = paper.is_shared === true;

  const authorText = (() => {
    const list = paper.metadata_json?.authors_list;
    if (Array.isArray(list) && list.length > 0) return list.join(', ');
    if (paper.metadata_json?.author) return String(paper.metadata_json.author);
    return null;
  })();

  const publicationYear = (() => {
    const pubDate = paper.metadata_json?.publication_date;
    if (pubDate) return String(pubDate).slice(0, 4);
    const year = paper.metadata_json?.year;
    if (year) return String(year);
    return null;
  })();

  const handleClick = selectionMode && onSelect
    ? () => onSelect(paper.id)
    : undefined;

  const cardInner = (
    <div
      className={cn(
        'group relative h-full rounded-2xl border overflow-hidden paper-card-hover flex flex-col',
        selected && 'ring-2 ring-[var(--foreground)]',
        selectionMode && 'cursor-pointer',
      )}
      style={{ backgroundColor: theme.bg, borderColor: selected ? undefined : theme.border, '--card-action': theme.action } as React.CSSProperties}
      onClick={handleClick}
    >
      {/* ── Header: status badges + year + actions ── */}
      <div className="flex items-start justify-between gap-2 px-4 pt-3.5 pb-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Selection checkbox */}
          {selectionMode && (
            <div className={cn(
              'w-4 h-4 rounded border-2 flex items-center justify-center transition-colors shrink-0',
              selected
                ? 'bg-[var(--foreground)] border-[var(--foreground)]'
                : 'bg-transparent border-[var(--mid-gray)]',
            )}>
              {selected && (
                <svg className="w-2.5 h-2.5 text-[var(--background)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
          )}

          {/* Processing badge (only when not completed) */}
          {paper.processing_status && paper.processing_status !== 'completed' && (
            <ProcessingStatusBadge status={paper.processing_status} />
          )}

          {/* Reading status */}
          {paper.reading_status && (
            <ReadingStatusBadge status={paper.reading_status} />
          )}

          {/* Shared indicator */}
          {isShared && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-[var(--sky-blue)]/10 text-[var(--sky-blue)]">
              <People size={10} />
              Shared
            </span>
          )}

          {/* Priority (only medium and above) */}
          {paper.priority && paper.priority !== 'low' && (
            <PriorityBadge priority={paper.priority} />
          )}
        </div>

        {/* Year + delete icon */}
        <div className="flex items-center gap-1.5 shrink-0">
          {publicationYear && (
            <span className="text-caption font-semibold opacity-60" style={{ color: theme.text }}>
              {publicationYear}
            </span>
          )}
          {!selectionMode && onDelete && (
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(paper.id); }}
              aria-label="Delete paper"
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg hover:bg-black/10"
              style={{ color: theme.text }}
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
      </div>

      {/* ── Inset content area ── */}
      <div
        className="rounded-t-xl border-t px-4 pt-3.5 pb-4 flex-1"
        style={{ backgroundColor: theme.accent, borderColor: theme.border }}
      >
        {/* Title */}
        <h4 className="text-body font-semibold leading-snug line-clamp-2 mb-1" style={{ color: theme.text }}>
          {paper.title}
        </h4>

        {/* Authors */}
        {authorText && (
          <p className="text-caption truncate opacity-70 mb-2" style={{ color: theme.text }}>
            {authorText}
          </p>
        )}

        {/* Abstract / content preview */}
        {paper.content_text && (
          <p className="text-caption line-clamp-2 leading-relaxed opacity-80 mb-3" style={{ color: theme.text }}>
            {paper.content_text.slice(0, 200)}
          </p>
        )}

        {/* Tags */}
        {paper.tags && paper.tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mt-auto">
            {paper.tags.slice(0, 4).map((tag) => (
              <span
                key={tag.id}
                className="px-1.5 py-0.5 rounded text-micro font-semibold"
                style={{ backgroundColor: theme.bg, color: theme.text }}
              >
                {tag.name}
              </span>
            ))}
            {paper.tags.length > 4 && (
              <span className="text-micro opacity-50" style={{ color: theme.text }}>
                +{paper.tags.length - 4}
              </span>
            )}
          </div>
        )}

        {/* Footer: source link */}
        {paper.url && (
          <div className="flex items-center justify-end mt-3 pt-2 border-t" style={{ borderColor: theme.border }}>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                window.open(paper.url, '_blank', 'noopener,noreferrer');
              }}
              className="inline-flex items-center gap-1 text-caption opacity-60 hover:opacity-100 transition-opacity cursor-pointer"
              style={{ color: theme.text }}
            >
              Source <ExternalLink size={10} />
            </button>
          </div>
        )}
      </div>
    </div>
  );

  if (selectionMode) return cardInner;

  return (
    <Link to={`/papers/${paper.id}`} className="block h-full">
      {cardInner}
    </Link>
  );
}

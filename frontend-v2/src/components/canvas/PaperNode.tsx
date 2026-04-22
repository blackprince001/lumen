import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Add as Plus, ExportSquare as ExternalLink } from 'iconsax-reactjs';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import type { Paper } from '@/lib/api/papers';

export interface PaperNodeData {
  paper: Paper;
  onRemove: (paperId: number) => void;
  [key: string]: unknown;
}

function PaperNodeComponent({ data, selected }: NodeProps) {
  const navigate = useNavigate();
  const { paper, onRemove } = data as PaperNodeData;

  const author = (paper.metadata_json?.author as string | undefined) ??
    (paper.metadata_json?.authors as string | undefined);
  const year = (paper.metadata_json?.year as string | undefined) ??
    (paper.metadata_json?.publication_date as string | undefined)?.slice(0, 4);

  return (
    <div
      className={cn(
        'w-[220px] rounded-xl border bg-[var(--card)] shadow-sm transition-all',
        selected
          ? 'border-[var(--foreground)] ring-1 ring-[var(--foreground)]'
          : 'border-[var(--border)] hover:border-[var(--muted-foreground)]'
      )}
    >
      <Handle type="target" position={Position.Top} className="!bg-[var(--muted-foreground)] !border-0 !w-2 !h-2" />

      <div className="p-3">
        <p className="text-code font-semibold text-[var(--foreground)] line-clamp-2 leading-snug">
          {paper.title}
        </p>
        {(author || year) && (
          <p className="text-caption text-[var(--muted-foreground)] mt-1 line-clamp-1">
            {[author, year].filter(Boolean).join(' · ')}
          </p>
        )}

        <div className="flex items-center gap-1 mt-2 pt-2 border-t border-[var(--border)]">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); navigate(`/papers/${paper.id}`); }}
            className="flex items-center gap-1 text-caption text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
          >
            <ExternalLink size={11} />
            Open
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onRemove(paper.id); }}
            className="ml-auto flex items-center justify-center w-5 h-5 rounded hover:bg-[var(--muted)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
            aria-label="Remove from canvas"
          >
            <Plus size={12} className="rotate-45" />
          </button>
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-[var(--muted-foreground)] !border-0 !w-2 !h-2" />
    </div>
  );
}

export const PaperNode = memo(PaperNodeComponent);

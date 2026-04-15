import { CloseCircle as X } from 'iconsax-reactjs';
import { cn } from '@/lib/utils';
import type { Tag } from '@/lib/api/tags';

interface TagListProps {
  tags: Tag[];
  onRemove?: (tagId: number) => void;
  showRemove?: boolean;
  className?: string;
}

export function TagList({ tags, onRemove, showRemove = false, className }: TagListProps) {
  if (tags.length === 0) return null;

  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {tags.map((tag) => (
        <span
          key={tag.id}
          className="inline-flex items-center gap-1 px-2 py-0.5 bg-[var(--muted)] rounded-badge text-caption text-[var(--foreground)]"
        >
          {tag.name}
          {showRemove && onRemove && (
            <button
              onClick={() => onRemove(tag.id)}
              aria-label={`Remove ${tag.name}`}
              className="hover:bg-[var(--border)] rounded-full p-0.5 transition-colors"
            >
              <X size={10} />
            </button>
          )}
        </span>
      ))}
    </div>
  );
}

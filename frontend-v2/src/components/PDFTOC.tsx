import { useState } from 'react';
import { CloseCircle as X, ArrowRight2 as ChevronRight, ArrowDown2 as ChevronDown } from 'iconsax-reactjs';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

export interface TOCItem {
  title: string;
  page: number;
  items?: TOCItem[];
}

interface PDFTOCProps {
  items: TOCItem[] | null;
  onItemClick: (page: number) => void;
  currentPage: number;
  onClose?: () => void;
}

function TOCItemComponent({
  item,
  onItemClick,
  currentPage,
  level = 0
}: {
  item: TOCItem;
  onItemClick: (page: number) => void;
  currentPage: number;
  level?: number;
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const hasChildren = item.items && item.items.length > 0;
  const isActive = item.page === currentPage;

  return (
    <div className="w-full">
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 text-code rounded-lg cursor-pointer transition-colors",
          isActive
            ? "bg-[var(--muted)] text-[var(--foreground)] font-medium"
            : "text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)]/50"
        )}
        style={{ paddingLeft: `${0.75 + level * 1}rem` }}
        onClick={(e) => {
          e.stopPropagation();
          onItemClick(item.page);
        }}
      >
        {hasChildren ? (
          <button
            className="p-0.5 hover:bg-[var(--muted)] rounded"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
          >
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        ) : (
          <span className="w-5" />
        )}
        <span className="flex-1 truncate">{item.title}</span>
        <span className="text-caption opacity-50 tabular-nums">{item.page}</span>
      </div>

      {hasChildren && isExpanded && (
        <div className="mt-0.5">
          {item.items!.map((child, index) => (
            <TOCItemComponent
              key={`${child.page}-${index}`}
              item={child}
              onItemClick={onItemClick}
              currentPage={currentPage}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function PDFTOC({ items, onItemClick, currentPage, onClose }: PDFTOCProps) {
  return (
    <div className="flex flex-col h-full bg-[var(--white)] overflow-hidden">
      <div className="flex items-center justify-between px-2">
        <h3 className="text-btn font-semibold text-[var(--foreground)]">Content</h3>
        {onClose && (
          <Button variant="ghost" className="h-8 w-8 p-0" onClick={onClose}>
            <X size={16} />
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2 scrollbar-none">
        {items && items.length > 0 ? (
          <div className="space-y-0.5">
            {items.map((item, index) => (
              <TOCItemComponent
                key={`${item.page}-${index}`}
                item={item}
                onItemClick={onItemClick}
                currentPage={currentPage}
              />
            ))}
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-[var(--muted-foreground)] opacity-60">
            <p className="text-code">No table of contents</p>
          </div>
        )}
      </div>
    </div>
  );
}

import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { Magicpen as Highlighter, Message as MessageSquare, Trash as Trash2, Edit as Edit2, ArrowRight2 as ChevronRight, ExportSquare } from 'iconsax-reactjs';
import { type Annotation } from '@/lib/api/annotations';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

interface PaperAnnotationsPanelProps {
  annotations: Annotation[];
  isLoading: boolean;
  currentPage: number;
  filterByPage: boolean;
  onFilterByPageChange: (value: boolean) => void;
  onAnnotationClick: (annotation: Annotation) => void;
  onEditAnnotation: (annotation: Annotation) => void;
  onDeleteAnnotation: (id: number) => void;
  isDeleting?: boolean;
}

export function PaperAnnotationsPanel({
  annotations,
  isLoading,
  currentPage,
  filterByPage,
  onFilterByPageChange,
  onAnnotationClick,
  onEditAnnotation,
  onDeleteAnnotation,
}: PaperAnnotationsPanelProps) {
  const navigate = useNavigate();
  const annotationItems = annotations.filter(ann => ann.type !== 'note');
  const noteItems = annotations.filter(ann => ann.type === 'note');

  const filteredAnnotations = filterByPage
    ? annotationItems.filter(ann => ann.coordinate_data?.page === currentPage)
    : annotationItems;

  if (isLoading) {
    return (
      <div className="p-8 space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-24 bg-[var(--muted)]/50 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  const renderAnnotationCard = (ann: Annotation) => {
    const isNote = ann.type === 'note';
    const page = ann.coordinate_data?.page as number | undefined;
    const isOnCurrentPage = page === currentPage;

    return (
      <div 
        key={ann.id}
        onClick={() => onAnnotationClick(ann)}
        className={cn(
          "group relative p-4 rounded-2xl border transition-all cursor-pointer",
          isOnCurrentPage 
            ? "bg-[var(--white)] border-[var(--foreground)]/20 shadow-sm" 
            : "bg-[var(--muted)]/20 border-transparent hover:bg-[var(--muted)]/40"
        )}
      >
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-1.5 overflow-hidden">
            {isNote ? (
              <MessageSquare size={13} className="text-[var(--muted-foreground)] shrink-0" />
            ) : (
              <Highlighter size={13} className="text-[var(--muted-foreground)] shrink-0" />
            )}
            {page && (
              <span className={cn(
                "text-micro font-bold px-1.5 py-0.5 rounded uppercase tracking-wider",
                isOnCurrentPage ? "bg-[var(--foreground)] text-[var(--white)]" : "bg-[var(--border)] text-[var(--muted-foreground)]"
              )}>
                Page {page}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button 
              variant="ghost" 
              className="h-6 w-6 p-0" 
              onClick={(e) => { e.stopPropagation(); onEditAnnotation(ann); }}
            >
              <Edit2 size={12} />
            </Button>
            <Button 
              variant="ghost" 
              className="h-6 w-6 p-0 text-[var(--destructive)] hover:bg-[var(--destructive)]/10"
              onClick={(e) => { e.stopPropagation(); onDeleteAnnotation(ann.id); }}
            >
              <Trash2 size={12} />
            </Button>
          </div>
        </div>

        {ann.highlighted_text && (
          <div className="mb-2 p-2 bg-[var(--white)] border border-[var(--border)] rounded-lg">
            <p className="text-caption text-[var(--muted-foreground)] line-clamp-2">
              "{ann.highlighted_text}"
            </p>
          </div>
        )}

        <p className="text-code text-[var(--foreground)] leading-relaxed whitespace-pre-wrap">
          {ann.content}
        </p>

        <div className="mt-3 flex items-center justify-between">
          <span className="text-micro text-[var(--muted-foreground)] opacity-60 font-medium uppercase tabular-nums">
            {format(new Date(ann.created_at), 'MMM d, yyyy')}
          </span>
          <ChevronRight size={12} className="text-[var(--muted-foreground)] opacity-0 group-hover:opacity-100 transition-all transform group-hover:translate-x-1" />
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-body font-bold text-[var(--foreground)]">Annotations</h3>
          <span className="text-caption bg-[var(--muted)] px-1.5 py-0.5 rounded-full text-[var(--muted-foreground)] tabular-nums">
            {annotationItems.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {annotationItems.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 text-caption text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              onClick={() => navigate('/annotations')}
            >
              <ExportSquare size={13} />
              Cite & Export
            </Button>
          )}
          <button 
          onClick={() => onFilterByPageChange(!filterByPage)}
          className={cn(
            "text-caption font-medium px-2 py-1 rounded-lg border transition-all",
            filterByPage 
              ? "bg-[var(--foreground)] text-[var(--white)] border-[var(--foreground)]" 
              : "text-[var(--muted-foreground)] border-[var(--border)] hover:border-[var(--muted-foreground)]/50"
          )}
        >
          {filterByPage ? `Page ${currentPage} only` : 'All pages'}
        </button>
        </div>
      </div>

      {filteredAnnotations.length > 0 ? (
        <div className="space-y-4">
          {filteredAnnotations.map(renderAnnotationCard)}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 px-6 text-center bg-[var(--muted)]/10 rounded-2xl border border-dashed border-[var(--border)]">
          <Highlighter size={32} className="mb-4 text-[var(--muted-foreground)] opacity-30" />
          <p className="text-code text-[var(--muted-foreground)]">
            {filterByPage ? `No annotations on page ${currentPage}` : 'No annotations yet'}
          </p>
        </div>
      )}

      {noteItems.length > 0 && (
        <div className="pt-8 border-t border-[var(--border)]">
          <div className="flex items-center gap-2 mb-4">
             <h3 className="text-body font-bold text-[var(--foreground)]">General Notes</h3>
             <span className="text-caption bg-[var(--muted)] px-1.5 py-0.5 rounded-full text-[var(--muted-foreground)] tabular-nums">
              {noteItems.length}
            </span>
          </div>
          <div className="space-y-4">
            {noteItems.map(renderAnnotationCard)}
          </div>
        </div>
      )}
    </div>
  );
}

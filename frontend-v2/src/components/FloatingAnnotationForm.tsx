import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { annotationsApi, type Annotation } from '@/lib/api/annotations';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { CloseCircle as X } from 'iconsax-reactjs';

interface FloatingAnnotationFormProps {
  paperId: number;
  coordinateData: { page: number; x: number; y: number };
  position: { x: number; y: number };
  annotation?: Annotation | null;
  highlightedText?: string;
  selectionData?: any;
  onCancel: () => void;
  onSuccess: () => void;
}

export function FloatingAnnotationForm({
  paperId,
  coordinateData,
  position,
  annotation,
  highlightedText,
  selectionData,
  onCancel,
  onSuccess,
}: FloatingAnnotationFormProps) {
  const formRef = useRef<HTMLDivElement>(null);
  const [formPosition, setFormPosition] = useState({ x: position.x, y: position.y });
  const [content, setContent] = useState('');
  const queryClient = useQueryClient();
  const isEditMode = !!annotation;

  // Initialize content
  useEffect(() => {
    if (annotation) {
      setContent(annotation.content || '');
    } else if (highlightedText) {
      setContent(highlightedText);
    } else {
      setContent('');
    }
  }, [annotation, highlightedText]);

  // Position logic
  useEffect(() => {
    if (!formRef.current) return;
    const form = formRef.current;
    const padding = 20;
    const rect = form.getBoundingClientRect();
    const formWidth = rect.width;
    const formHeight = rect.height;

    let x = position.x;
    let y = position.y;

    // Adjust horizontal
    if (x + formWidth > window.innerWidth - padding) {
      x = window.innerWidth - formWidth - padding;
    }
    if (x < padding) x = padding;

    // Adjust vertical
    if (y + formHeight > window.innerHeight - padding) {
      y = y - formHeight - 10;
      if (y < padding) {
        y = padding;
        form.style.maxHeight = `${window.innerHeight - padding * 2}px`;
      }
    }

    setFormPosition({ x, y });
  }, [position.x, position.y, annotation]);

  // Mutations
  const createMutation = useMutation({
    mutationFn: () =>
      annotationsApi.create({
        paper_id: paperId,
        content,
        type: 'annotation',
        highlighted_text: highlightedText || undefined,
        selection_data: selectionData || undefined,
        coordinate_data: coordinateData || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['annotations', paperId] });
      onSuccess();
    },
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      annotationsApi.update(annotation!.id, {
        content,
        highlighted_text: highlightedText || annotation?.highlighted_text,
        selection_data: selectionData || annotation?.selection_data,
        coordinate_data: coordinateData || annotation?.coordinate_data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['annotations', paperId] });
      onSuccess();
    },
  });

  const mutation = isEditMode ? updateMutation : createMutation;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (content.trim()) {
      mutation.mutate();
    }
  };

  // Click outside and Escape logic
  useEffect(() => {
    const handleEvents = (e: any) => {
      if (e.key === 'Escape') onCancel();
      if (e.type === 'mousedown') {
        if (formRef.current && !formRef.current.contains(e.target as Node)) {
          if (!(e.target as HTMLElement).closest('.react-pdf__Page')) {
            onCancel();
          }
        }
      }
    };
    document.addEventListener('keydown', handleEvents);
    const timeout = setTimeout(() => {
      document.addEventListener('mousedown', handleEvents);
    }, 100);
    return () => {
      document.removeEventListener('keydown', handleEvents);
      document.removeEventListener('mousedown', handleEvents);
      clearTimeout(timeout);
    };
  }, [onCancel]);

  return (
    <div
      ref={formRef}
      className="fixed z-50 bg-[var(--white)] border border-[var(--border)] rounded-xl shadow-elevated p-4 animate-in fade-in zoom-in-95 duration-200"
      style={{
        left: `${formPosition.x}px`,
        top: `${formPosition.y}px`,
        width: '20rem',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-code font-semibold text-[var(--foreground)]">
          {isEditMode ? 'Edit' : highlightedText ? 'Highlight Note' : 'Add Note'}
        </h3>
        <Button variant="ghost" className="h-6 w-6 p-0" onClick={onCancel}>
          <X size={14} />
        </Button>
      </div>

      {highlightedText && (
        <div className="mb-3 p-2 bg-[var(--muted)]/30 border-l-2 border-[var(--foreground)]/20 rounded-r-md">
          <p className="text-caption text-[var(--muted-foreground)] italic line-clamp-2">
            "{highlightedText}"
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Add your thoughts..."
          rows={4}
          autoFocus
          className="text-code bg-[var(--white)]"
        />
        
        <div className="flex items-center justify-between gap-2">
          <span className="text-micro text-[var(--muted-foreground)]">
            Pg {coordinateData.page}
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              className="h-8 text-caption px-3"
              onClick={onCancel}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="h-8 text-caption px-4"
              disabled={!content.trim() || mutation.isPending}
            >
              {mutation.isPending ? 'Saving...' : (isEditMode ? 'Update' : 'Save')}
            </Button>
          </div>
        </div>
        
        {mutation.isError && (
          <p className="text-caption text-[var(--destructive)]">
            Error saving annotation.
          </p>
        )}
      </form>
    </div>
  );
}

import { useEffect, useMemo, useRef } from 'react';
import { AnnotationCard } from './AnnotationCard';
import { annotationAnchorY, annotationPage } from './annotation-geometry';
import type { Annotation } from '@/lib/api/annotations';

/**
 * Side-panel list of annotations sorted by document position. Click jumps
 * the viewer to the annotation; the active card follows viewer state.
 */
export function AnnotationsPanel({
  annotations,
  activeId,
  onSelect,
  onDelete,
}: {
  annotations: Annotation[];
  activeId: number | null;
  onSelect: (annotation: Annotation) => void;
  onDelete: (annotation: Annotation) => void;
}) {
  const cardRefs = useRef(new Map<number, HTMLDivElement>());

  const entries = useMemo(() => {
    const sorted = [...annotations]
      .filter((a) => a.type !== 'note')
      .sort((a, b) => {
        const pageDiff = (annotationPage(a) ?? 0) - (annotationPage(b) ?? 0);
        if (pageDiff !== 0) return pageDiff;
        return annotationAnchorY(a) - annotationAnchorY(b);
      });
    let lastPage: number | null = null;
    return sorted.map((annotation) => {
      const page = annotationPage(annotation);
      const showPageHeading = page !== null && page !== lastPage;
      lastPage = page ?? lastPage;
      return { annotation, page, showPageHeading };
    });
  }, [annotations]);

  useEffect(() => {
    if (activeId === null) return;
    cardRefs.current.get(activeId)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [activeId]);

  if (entries.length === 0) {
    return (
      <p className="px-3 py-6 text-center text-caption text-(--muted-foreground)">
        No annotations yet. Select text in the document to highlight, comment,
        or ask the AI.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-3">
      {entries.map(({ annotation, page, showPageHeading }) => {
        return (
          <div
            key={annotation.id}
            ref={(el) => {
              if (el) cardRefs.current.set(annotation.id, el);
              else cardRefs.current.delete(annotation.id);
            }}
          >
            {showPageHeading && (
              <div className="mb-1 px-0.5 text-micro font-semibold tracking-wider text-(--muted-foreground) uppercase">
                Page {page}
              </div>
            )}
            <AnnotationCard
              annotation={annotation}
              active={annotation.id === activeId}
              compact
              onClick={() => onSelect(annotation)}
              onDelete={() => onDelete(annotation)}
            />
          </div>
        );
      })}
    </div>
  );
}

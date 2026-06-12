import type { Annotation } from '@/lib/api/annotations';

export interface NormalizedRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function annotationPage(ann: Annotation): number | null {
  const coord = ann.coordinate_data as { page?: number } | undefined;
  return coord?.page ?? null;
}

/** Per-line rects with fallback to the single boundingBox (old annotations). */
export function annotationRects(ann: Annotation): NormalizedRect[] {
  const sd = ann.selection_data as
    | { rects?: NormalizedRect[]; boundingBox?: NormalizedRect }
    | undefined;
  if (!sd) return [];
  if (Array.isArray(sd.rects) && sd.rects.length > 0) return sd.rects;
  if (sd.boundingBox && typeof sd.boundingBox.left === 'number') return [sd.boundingBox];
  return [];
}

/** Vertical anchor (0-1) of an annotation on its page. */
export function annotationAnchorY(ann: Annotation): number {
  const rects = annotationRects(ann);
  if (rects.length > 0) return rects[0].top;
  const coord = ann.coordinate_data as { y?: number } | undefined;
  return coord?.y ?? 0;
}

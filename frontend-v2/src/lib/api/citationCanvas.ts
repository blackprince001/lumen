import { api } from './client';
import type { Paper } from './papers';

export interface CanvasItem {
  paper_id: number;
  x: number;
  y: number;
  created_at: string;
  updated_at: string;
  paper: Paper;
}

export interface CanvasEdge {
  source: number;
  target: number;
}

export interface CanvasResponse {
  items: CanvasItem[];
  edges: CanvasEdge[];
}

export interface CanvasItemPosition {
  paper_id: number;
  x: number;
  y: number;
}

export const citationCanvasApi = {
  get: (): Promise<CanvasResponse> => api.get<CanvasResponse>('/citation-canvas'),

  addItem: (paperId: number, x: number, y: number): Promise<CanvasItem> =>
    api.post<CanvasItem>('/citation-canvas/items', { paper_id: paperId, x, y }),

  updatePosition: (paperId: number, x: number, y: number): Promise<CanvasItem> =>
    api.patch<CanvasItem>(`/citation-canvas/items/${paperId}`, { x, y }),

  bulkUpdatePositions: (items: CanvasItemPosition[]): Promise<void> =>
    api.post<void>('/citation-canvas/positions', { items }),

  removeItem: (paperId: number): Promise<void> =>
    api.delete<void>(`/citation-canvas/items/${paperId}`),

  clear: (): Promise<void> => api.delete<void>('/citation-canvas'),
};

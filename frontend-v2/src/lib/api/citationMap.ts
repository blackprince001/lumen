import { api } from './client';

export interface MapNodePosition {
  x: number;
  y: number;
}

export interface MapNode {
  key: string;
  s2_id: string | null;
  library_paper_id: number | null;
  title: string;
  authors: string;
  year: number | null;
  citation_count: number | null;
  is_focal: boolean;
  is_library: boolean;
  shared: boolean;
  doi: string | null;
  url: string | null;
  position: MapNodePosition | null;
}

export interface MapEdge {
  source: string;
  target: string;
  /** "reference" = focal paper cites target (what it built on). */
  type: 'reference';
}

export interface UnresolvedPaper {
  library_paper_id: number;
  title: string;
}

export interface CitationMapResponse {
  nodes: MapNode[];
  edges: MapEdge[];
  focal_paper_ids: number[];
  unresolved: UnresolvedPaper[];
}

export interface PositionUpdate {
  node_key: string;
  x: number;
  y: number;
}

export interface CitedByPaper {
  s2_id: string | null;
  title: string | null;
  authors: string[];
  year: number | null;
  citation_count: number | null;
  doi: string | null;
  url: string | null;
}

export interface CitedByResponse {
  paper_id: number;
  resolved: boolean;
  citations: CitedByPaper[];
  offset: number;
  limit: number;
  has_more: boolean;
}

export const citationMapApi = {
  get: (): Promise<CitationMapResponse> =>
    api.get<CitationMapResponse>('/citation-map'),

  addFocal: (paperId: number): Promise<CitationMapResponse> =>
    api.post<CitationMapResponse>('/citation-map/focal', { paper_id: paperId }),

  removeFocal: (paperId: number): Promise<CitationMapResponse> =>
    api.delete<CitationMapResponse>(`/citation-map/focal/${paperId}`),

  savePositions: (positions: PositionUpdate[]): Promise<void> =>
    api.post<void>('/citation-map/positions', { positions }),

  clear: (): Promise<void> => api.delete<void>('/citation-map'),

  citedBy: (paperId: number, offset = 0, limit = 25): Promise<CitedByResponse> =>
    api.get<CitedByResponse>(`/citation-map/cited-by/${paperId}`, {
      params: { offset, limit },
    }),
};

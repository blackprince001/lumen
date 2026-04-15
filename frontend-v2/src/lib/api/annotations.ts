import { api } from './client';

export interface Annotation {
  id: number;
  paper_id: number;
  content: string;
  type?: string;
  highlighted_text?: string;
  selection_data?: Record<string, unknown>;
  note_scope?: string;
  coordinate_data?: Record<string, unknown>;
  auto_highlighted?: boolean;
  highlight_type?: string;
  created_at: string;
  updated_at: string;
}

export interface AnnotationCreate {
  paper_id: number;
  content: string;
  type?: string;
  highlighted_text?: string;
  selection_data?: Record<string, unknown>;
  note_scope?: string;
  coordinate_data?: Record<string, unknown>;
}

export interface AnnotationUpdate {
  content?: string;
  type?: string;
  highlighted_text?: string;
  selection_data?: Record<string, unknown>;
  note_scope?: string;
  coordinate_data?: Record<string, unknown>;
}

export const annotationsApi = {
  list: (paperId: number): Promise<Annotation[]> =>
    api.get<Annotation[]>(`/papers/${paperId}/annotations`),

  get: (id: number): Promise<Annotation> =>
    api.get<Annotation>(`/annotations/${id}`),

  create: (annotation: AnnotationCreate): Promise<Annotation> =>
    api.post<Annotation>(`/papers/${annotation.paper_id}/annotations`, annotation),

  update: (id: number, updates: AnnotationUpdate): Promise<Annotation> =>
    api.patch<Annotation>(`/annotations/${id}`, updates),

  delete: async (id: number): Promise<void> => {
    await api.delete(`/annotations/${id}`);
  },
};

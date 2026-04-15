import { api } from './client';

export interface ExportRequest {
  paper_ids: number[];
  format: 'csv' | 'json' | 'ris' | 'endnote' | 'bibtex';
  include_annotations?: boolean;
}

export interface CitationExportRequest {
  paper_ids: number[];
  format: 'apa' | 'mla' | 'bibtex';
}

export const exportApi = {
  exportPapers: (request: ExportRequest): Promise<Blob> =>
    api.post<Blob>('/papers/export', request, { responseType: 'blob' }),

  exportCitations: (request: CitationExportRequest): Promise<Blob> =>
    api.post<Blob>('/papers/export/citations', request, { responseType: 'blob' }),

  generateBibliography: (
    paperIds: number[],
    format: 'apa' | 'mla' | 'bibtex' | 'chicago' | 'ieee'
  ): Promise<Blob> => {
    const params = new URLSearchParams();
    paperIds.forEach((id) => params.append('paper_ids', id.toString()));
    params.append('format', format);
    return api.post<Blob>(`/papers/export/bibliography?${params.toString()}`, null, {
      responseType: 'blob',
    });
  },
};

import { api } from './client';

export interface SummaryResponse {
  summary: string;
  generated_at?: string;
}

export interface FindingsResponse {
  findings: {
    key_findings?: string[];
    conclusions?: string[];
    methodology?: string;
    limitations?: string[];
    future_work?: string[];
  };
}

export interface ReadingGuideResponse {
  guide: {
    pre_reading?: string[];
    during_reading?: string[];
    post_reading?: string[];
  };
}

export const aiFeaturesApi = {
  generateSummary: (paperId: number): Promise<SummaryResponse> =>
    api.post<SummaryResponse>(`/papers/${paperId}/generate-summary`),

  getSummary: (paperId: number): Promise<SummaryResponse> =>
    api.get<SummaryResponse>(`/papers/${paperId}/summary`),

  updateSummary: (paperId: number, summary: string): Promise<SummaryResponse> =>
    api.put<SummaryResponse>(`/papers/${paperId}/summary`, { summary }),

  extractFindings: (paperId: number): Promise<FindingsResponse> =>
    api.post<FindingsResponse>(`/papers/${paperId}/extract-findings`),

  getFindings: (paperId: number): Promise<FindingsResponse> =>
    api.get<FindingsResponse>(`/papers/${paperId}/findings`),

  updateFindings: (paperId: number, findings: FindingsResponse['findings']): Promise<FindingsResponse> =>
    api.put<FindingsResponse>(`/papers/${paperId}/findings`, { findings }),

  generateReadingGuide: (paperId: number): Promise<ReadingGuideResponse> =>
    api.post<ReadingGuideResponse>(`/papers/${paperId}/generate-reading-guide`),

  getReadingGuide: (paperId: number): Promise<ReadingGuideResponse> =>
    api.get<ReadingGuideResponse>(`/papers/${paperId}/reading-guide`),

  updateReadingGuide: (paperId: number, guide: ReadingGuideResponse['guide']): Promise<ReadingGuideResponse> =>
    api.put<ReadingGuideResponse>(`/papers/${paperId}/reading-guide`, { guide }),

  generateHighlights: (paperId: number): Promise<{ message: string; count: number }> =>
    api.post(`/papers/${paperId}/generate-highlights`),
};

import { api } from './client';

export interface DiscoverySearchFilters {
  year_from?: number;
  year_to?: number;
  authors?: string[];
  min_citations?: number;
}

export interface DiscoverySearchRequest {
  query: string;
  sources?: string[];
  filters?: DiscoverySearchFilters;
  limit?: number;
  include_embeddings?: boolean;
}

export interface DiscoveredPaperPreview {
  source: string;
  external_id: string;
  title: string;
  authors: string[];
  abstract?: string;
  year?: number;
  doi?: string;
  url?: string;
  pdf_url?: string;
  citation_count?: number;
  relevance_score?: number;
}

export interface SourceSearchResult {
  source: string;
  papers: DiscoveredPaperPreview[];
  total_available?: number;
  error?: string;
}

export interface DiscoverySearchResponse {
  query: string;
  sources_searched: string[];
  results: SourceSearchResult[];
  total_results: number;
  deduplicated_count: number;
}

export interface DiscoverySourceInfo {
  name: string;
  display_name: string;
  description: string;
  supports_search: boolean;
  supports_citations: boolean;
  supports_recommendations: boolean;
  rate_limit?: string;
}

export interface DiscoverySourcesResponse {
  sources: DiscoverySourceInfo[];
}

export interface AddToLibraryResponse {
  paper_id: number;
  title: string;
  message: string;
}

export interface BatchAddToLibraryRequest {
  discovered_paper_ids: number[];
  group_ids?: number[];
  tag_ids?: number[];
}

export interface BatchAddToLibraryResponse {
  added: AddToLibraryResponse[];
  errors: Array<{ discovered_paper_id?: number; title?: string; error: string }>;
}

export interface CitationExplorerRequest {
  source: string;
  external_id: string;
  direction?: 'citations' | 'references' | 'both';
  limit?: number;
}

export interface CitationExplorerResponse {
  paper: DiscoveredPaperPreview;
  citations: DiscoveredPaperPreview[];
  references: DiscoveredPaperPreview[];
  citations_count: number;
  references_count: number;
}

export interface RecommendationRequest {
  based_on?: 'library' | 'paper' | 'group';
  paper_id?: number;
  group_id?: number;
  sources?: string[];
  limit?: number;
}

export interface RecommendationResponse {
  based_on: string;
  recommendations: DiscoveredPaperPreview[];
  total: number;
}

export interface QueryUnderstanding {
  interpreted_query: string;
  boolean_query?: string;
  key_concepts: string[];
  search_terms: string[];
  domain_hints: string[];
  query_type: 'exploratory' | 'specific' | 'comparative' | 'methodological';
}

export interface SearchOverview {
  overview: string;
  key_themes: string[];
  notable_trends: string[];
  research_gaps: string[];
  suggested_followups: string[];
}

export interface PaperCluster {
  name: string;
  description: string;
  keywords: string[];
  paper_indices: number[];
}

export interface ClusteringResult {
  clusters: PaperCluster[];
  unclustered_indices: number[];
}

export interface PaperRelevanceExplanation {
  paper_index: number;
  relevance: string;
  key_contribution: string;
  relevance_score: number;
}

export interface RelevanceExplanations {
  explanations: PaperRelevanceExplanation[];
}

export interface AISearchRequest {
  query: string;
  sources?: string[];
  filters?: DiscoverySearchFilters;
  limit?: number;
  include_overview?: boolean;
  include_clustering?: boolean;
  include_relevance?: boolean;
}

export interface AISearchResponse {
  query: string;
  query_understanding?: QueryUnderstanding;
  sources_searched: string[];
  results: SourceSearchResult[];
  total_results: number;
  deduplicated_count: number;
  overview?: SearchOverview;
  clustering?: ClusteringResult;
  relevance_explanations?: RelevanceExplanations;
}

export interface DiscoverySessionCreate {
  name?: string;
  query: string;
  sources: string[];
  filters_json: Record<string, unknown>;
  query_understanding?: QueryUnderstanding | null;
  overview?: SearchOverview | null;
  clustering?: ClusteringResult | null;
  relevance_explanations?: PaperRelevanceExplanation[] | null;
  papers?: DiscoveredPaperPreview[] | null;
}

export interface DiscoverySession {
  id: number;
  name?: string;
  query: string;
  sources: string[];
  filters_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  paper_count: number;
}

export interface DiscoverySessionDetail extends DiscoverySession {
  papers: DiscoveredPaperPreview[];
  query_understanding?: QueryUnderstanding | null;
  overview?: SearchOverview | null;
  clustering?: ClusteringResult | null;
  relevance_explanations?: PaperRelevanceExplanation[] | null;
}

export const discoveryApi = {
  getSources: (): Promise<DiscoverySourcesResponse> =>
    api.get<DiscoverySourcesResponse>('/discovery/sources'),

  search: (request: DiscoverySearchRequest): Promise<DiscoverySearchResponse> =>
    api.post<DiscoverySearchResponse>('/discovery/search', request),

  aiSearch: (request: AISearchRequest): Promise<AISearchResponse> =>
    api.post<AISearchResponse>('/discovery/ai-search', request),

  getPaperDetails: (source: string, externalId: string): Promise<DiscoveredPaperPreview> =>
    api.get<DiscoveredPaperPreview>(`/discovery/paper/${source}/${encodeURIComponent(externalId)}`),

  addToLibrary: (discoveredPaperId: number, groupIds?: number[]): Promise<AddToLibraryResponse> => {
    const params: Record<string, string | number | boolean | undefined> = {};
    if (groupIds && groupIds.length > 0) params.group_ids = groupIds.join(',');
    return api.post<AddToLibraryResponse>(
      `/discovery/paper/${discoveredPaperId}/add-to-library`,
      undefined,
      { params }
    );
  },

  batchAddToLibrary: (request: BatchAddToLibraryRequest): Promise<BatchAddToLibraryResponse> =>
    api.post<BatchAddToLibraryResponse>('/discovery/batch/add-to-library', request),

  exploreCitations: (request: CitationExplorerRequest): Promise<CitationExplorerResponse> =>
    api.post<CitationExplorerResponse>('/discovery/citations', request),

  getRecommendations: (request: RecommendationRequest): Promise<RecommendationResponse> =>
    api.post<RecommendationResponse>('/discovery/recommendations', request),

  getCachedPapers: (source?: string, limit = 50, offset = 0): Promise<{
    papers: DiscoveredPaperPreview[];
    total: number;
    offset: number;
    limit: number;
  }> => api.get('/discovery/cached', { params: { source, limit, offset } }),

  getSessions: (limit = 50, offset = 0): Promise<DiscoverySession[]> =>
    api.get<DiscoverySession[]>('/discovery/sessions', { params: { limit, offset } }),

  createSession: (session: DiscoverySessionCreate): Promise<DiscoverySession> =>
    api.post<DiscoverySession>('/discovery/sessions', session),

  getSession: (sessionId: number): Promise<DiscoverySessionDetail> =>
    api.get<DiscoverySessionDetail>(`/discovery/sessions/${sessionId}`),

  deleteSession: (sessionId: number): Promise<{ message: string; id: number }> =>
    api.delete<{ message: string; id: number }>(`/discovery/sessions/${sessionId}`),

  updateSession: (sessionId: number, name?: string): Promise<DiscoverySession> =>
    api.put<DiscoverySession>(`/discovery/sessions/${sessionId}`, undefined, { params: { name } }),
};

export default discoveryApi;

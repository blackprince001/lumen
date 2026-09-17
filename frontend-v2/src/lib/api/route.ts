import { api } from './client';

export type RouteDestination =
  | 'library_search'
  | 'discovery_search'
  | 'ai_search'
  | 'deep_research'
  | 'unsupported';

export type RouteAction = 'route' | 'suggest' | 'fallback';

export interface RouteResult {
  destination: RouteDestination;
  action: RouteAction;
  confidence: number;
  probabilities: Record<string, number>;
  model: string;
  fallback: boolean;
  context?: {
    library?: { total_papers: number; title_matches: number; match_titles: string[] };
  };
}

export const routeApi = {
  route: (query: string): Promise<RouteResult> =>
    api.post<RouteResult>('/route', { query }),
};

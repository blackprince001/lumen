import { useState, useCallback, useRef } from 'react';
import { flushSync } from 'react-dom';
import { logger } from '@/lib/logger';
import { getAuthHeaders } from '@/lib/api/client';
import type {
  DiscoveredPaperPreview,
  QueryUnderstanding,
  SearchOverview,
  ClusteringResult,
  PaperRelevanceExplanation,
  AISearchRequest,
} from '@/lib/api/discovery';

export interface SearchStatus {
  stage: string;
  message: string;
  progress: number;
  source?: string;
}

export interface TimelineEntry {
  id: number;
  stage: string;
  message: string;
  source?: string;
  timestamp: number;
}

interface SourceResult {
  source: string;
  papers: DiscoveredPaperPreview[];
  total_available?: number;
  error?: string;
}

export interface AISearchStreamState {
  isSearching: boolean;
  isComplete: boolean;
  status: SearchStatus | null;
  timeline: TimelineEntry[];
  allPapers: DiscoveredPaperPreview[];
  sourceResults: Record<string, SourceResult>;
  queryUnderstanding: QueryUnderstanding | null;
  overview: SearchOverview | null;
  clustering: ClusteringResult | null;
  relevanceExplanations: PaperRelevanceExplanation[];
  error: string | null;
}

const INITIAL: AISearchStreamState = {
  isSearching: false,
  isComplete: false,
  status: null,
  timeline: [],
  allPapers: [],
  sourceResults: {},
  queryUnderstanding: null,
  overview: null,
  clustering: null,
  relevanceExplanations: [],
  error: null,
};

let timelineCounter = 0;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyEvent(eventType: string, data: any, prev: AISearchStreamState): AISearchStreamState {
  switch (eventType) {
    case 'status': {
      const status: SearchStatus = {
        stage: data.stage,
        message: data.message,
        progress: data.progress,
        source: data.source,
      };
      const lastEntry = prev.timeline[prev.timeline.length - 1];
      const isDup = lastEntry && lastEntry.stage === status.stage && lastEntry.message === status.message;
      const timeline = isDup ? prev.timeline : [
        ...prev.timeline,
        { id: ++timelineCounter, stage: status.stage, message: status.message, source: status.source, timestamp: Date.now() },
      ];
      return { ...prev, status, timeline };
    }

    case 'source_results': {
      const sr: SourceResult = { source: data.source, papers: data.papers, total_available: data.total_available, error: data.error };
      const sourceResults = { ...prev.sourceResults, [sr.source]: sr };
      const timeline = [
        ...prev.timeline,
        {
          id: ++timelineCounter,
          stage: 'source_results',
          message: sr.error
            ? `${sr.source} failed: ${sr.error}`
            : `${sr.source} returned ${sr.papers.length} papers`,
          source: sr.source,
          timestamp: Date.now(),
        },
      ];
      return { ...prev, sourceResults, timeline, allPapers: Object.values(sourceResults).flatMap((r) => r.papers) };
    }

    case 'query_understanding':
      return { ...prev, queryUnderstanding: data as QueryUnderstanding };

    case 'overview':
      return { ...prev, overview: data as SearchOverview };

    case 'clustering':
      return { ...prev, clustering: data as ClusteringResult };

    case 'relevance':
      return { ...prev, relevanceExplanations: (data.explanations ?? []) as PaperRelevanceExplanation[] };

    case 'complete':
      return { ...prev, isSearching: false, isComplete: true, status: { stage: 'complete', message: 'Search complete', progress: 100 } };

    case 'error':
      return { ...prev, isSearching: false, error: data.message as string };

    default:
      return prev;
  }
}

export function useAISearchStream() {
  const [state, setState] = useState<AISearchStreamState>(INITIAL);
  const abortRef = useRef<AbortController | null>(null);

  const search = useCallback(async (request: AISearchRequest) => {
    abortRef.current?.abort();
    timelineCounter = 0;
    setState({ ...INITIAL, isSearching: true });

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
      const response = await fetch(`${API_BASE_URL}/discovery/ai-search/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream', ...getAuthHeaders() },
        signal: controller.signal,
        body: JSON.stringify({
          query: request.query,
          sources: request.sources ?? ['arxiv', 'semantic_scholar', 'google_scholar'],
          filters: request.filters,
          limit: request.limit ?? 20,
          include_overview: request.include_overview ?? true,
          include_clustering: request.include_clustering ?? true,
          include_relevance: request.include_relevance ?? true,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ detail: 'Search failed' }));
        throw new Error(err.detail || `HTTP ${response.status}`);
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      const dispatch = (eventType: string, rawData: string) => {
        if (!eventType || !rawData) return;
        try {
          const data = JSON.parse(rawData);
          // flushSync so each SSE event triggers its own render, avoiding
          // React 18 automatic batching collapsing rapid events into one paint.
          flushSync(() => {
            setState((prev) => applyEvent(eventType, data, prev));
          });
        } catch (e) {
          logger.warn('Failed to parse SSE event:', eventType, e);
        }
      };

      const processBlock = (block: string) => {
        let eventType = '';
        const dataLines: string[] = [];
        for (const rawLine of block.split('\n')) {
          const line = rawLine.replace(/\r$/, '');
          if (!line) continue;
          if (line.startsWith('event:')) {
            eventType = line.slice(6).trim();
          } else if (line.startsWith('data:')) {
            dataLines.push(line.slice(5).replace(/^ /, ''));
          }
        }
        if (eventType && dataLines.length) {
          dispatch(eventType, dataLines.join('\n'));
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          if (buffer.trim()) processBlock(buffer);
          break;
        }

        buffer += decoder.decode(value, { stream: true });

        // SSE events are separated by a blank line (\n\n or \r\n\r\n).
        let sepIdx: number;
        // Loop as long as we can find a complete event block in the buffer.
        // eslint-disable-next-line no-cond-assign
        while ((sepIdx = findEventSeparator(buffer)) !== -1) {
          const block = buffer.slice(0, sepIdx);
          buffer = buffer.slice(sepIdx).replace(/^(\r?\n){1,2}/, '');
          processBlock(block);
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setState((prev) => ({ ...prev, isSearching: false, error: (err as Error).message || 'Search failed' }));
    }
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState((prev) => ({ ...prev, isSearching: false }));
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState(INITIAL);
  }, []);

  return { ...state, search, cancel, reset };
}

function findEventSeparator(buffer: string): number {
  const lf = buffer.indexOf('\n\n');
  const crlf = buffer.indexOf('\r\n\r\n');
  if (lf === -1) return crlf;
  if (crlf === -1) return lf;
  return Math.min(lf, crlf);
}

export default useAISearchStream;

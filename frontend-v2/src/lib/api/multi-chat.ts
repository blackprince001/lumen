import { logger } from '../logger';
import { api, getAuthHeaders } from './client';
import type { ChatReferences, StreamChunk } from './chat';

export interface PaperSummary {
  id: number;
  title: string;
  has_file: boolean;
}

export interface MultiChatMessage {
  id: number;
  session_id: number;
  role: 'user' | 'assistant';
  content: string;
  references?: ChatReferences;
  created_at: string;
  parent_message_id: number | null;
  thread_count: number;
}

export interface MultiChatSession {
  id: number;
  name: string;
  group_id: number | null;
  paper_ids: number[];
  papers: PaperSummary[];
  messages: MultiChatMessage[];
  created_at: string;
  updated_at: string;
}

export interface MultiChatRequest {
  message: string;
  references?: ChatReferences;
  session_id?: number;
  paper_ids?: number[];
  group_id?: number;
}

const EMPTY_REFS: ChatReferences = { notes: [], annotations: [], papers: [] };

async function* parseSSEStream(response: Response): AsyncGenerator<StreamChunk, void, unknown> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            yield JSON.parse(line.slice(6)) as StreamChunk;
          } catch (e) {
            logger.warn('Failed to parse SSE data:', e);
          }
        }
      }
    }

    if (buffer.startsWith('data: ')) {
      try {
        yield JSON.parse(buffer.slice(6)) as StreamChunk;
      } catch (e) {
        logger.warn('Failed to parse SSE data:', e);
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export const multiChatApi = {
  // Group-scoped

  streamGroupMessage: async function* (
    groupId: number,
    message: string,
    references?: ChatReferences,
    sessionId?: number
  ): AsyncGenerator<StreamChunk, void, unknown> {
    const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
    const response = await fetch(`${API_BASE_URL}/groups/${groupId}/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({
        message,
        references: references ?? EMPTY_REFS,
        session_id: sessionId,
        group_id: groupId,
      }),
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    yield* parseSSEStream(response);
  },

  getGroupHistory: (groupId: number): Promise<MultiChatSession | null> =>
    api.get<MultiChatSession | null>(`/groups/${groupId}/chat`),

  getGroupSessions: (groupId: number): Promise<MultiChatSession[]> =>
    api.get<MultiChatSession[]>(`/groups/${groupId}/multi-sessions`),

  createGroupSession: (groupId: number, name?: string, paperIds?: number[]): Promise<MultiChatSession> =>
    api.post<MultiChatSession>(`/groups/${groupId}/multi-sessions`, {
      name: name ?? undefined,
      paper_ids: paperIds ?? undefined,
      group_id: groupId,
    }),

  // Ad-hoc multi-paper

  streamMultiMessage: async function* (
    paperIds: number[],
    message: string,
    references?: ChatReferences,
    sessionId?: number
  ): AsyncGenerator<StreamChunk, void, unknown> {
    const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
    const response = await fetch(`${API_BASE_URL}/multi-chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({
        message,
        references: references ?? EMPTY_REFS,
        session_id: sessionId,
        paper_ids: paperIds,
      }),
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    yield* parseSSEStream(response);
  },

  // Session-level

  getSession: (sessionId: number): Promise<MultiChatSession> =>
    api.get<MultiChatSession>(`/multi-chat/sessions/${sessionId}`),

  updateSession: (sessionId: number, name: string): Promise<MultiChatSession> =>
    api.patch<MultiChatSession>(`/multi-chat/sessions/${sessionId}`, { name }),

  deleteSession: async (sessionId: number): Promise<void> => {
    await api.delete(`/multi-chat/sessions/${sessionId}`);
  },

  clearSessionMessages: async (sessionId: number): Promise<void> => {
    await api.delete(`/multi-chat/sessions/${sessionId}/messages`);
  },
};

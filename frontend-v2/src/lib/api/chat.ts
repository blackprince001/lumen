import { api } from './client';

export interface ChatReferences {
  notes: Array<{ id: number; type: 'note'; content?: string; display?: string }>;
  annotations: Array<{ id: number; type: 'annotation'; content?: string; highlighted_text?: string; display?: string }>;
  papers: Array<{ id: number; type: 'paper'; title?: string; display?: string }>;
}

export interface ChatMessage {
  id: number;
  session_id: number;
  role: 'user' | 'assistant';
  content: string;
  references?: ChatReferences;
  created_at: string;
  parent_message_id: number | null;
  thread_count: number;
}

export interface ChatSession {
  id: number;
  paper_id: number;
  name: string;
  created_at: string;
  updated_at: string;
  messages: ChatMessage[];
}

export interface ChatRequest {
  message: string;
  references?: ChatReferences;
  session_id?: number;
}

export interface ChatResponse {
  message: ChatMessage;
  session: ChatSession;
}

export interface ReferenceItem {
  id: number;
  type: 'note' | 'annotation' | 'paper';
  display: string;
  content?: string;
  title?: string;
}

export interface ThreadRequest {
  message: string;
  references?: ChatReferences;
}

export interface ThreadResponse {
  message: ChatMessage;
  parent_message: ChatMessage;
}

const EMPTY_REFS: ChatReferences = { notes: [], annotations: [], papers: [] };

export const chatApi = {
  sendMessage: (paperId: number, message: string, references?: ChatReferences, sessionId?: number): Promise<ChatResponse> =>
    api.post<ChatResponse>(`/papers/${paperId}/chat`, {
      message,
      references: references ?? EMPTY_REFS,
      session_id: sessionId,
    }),

  getHistory: (paperId: number): Promise<ChatSession | null> =>
    api.get<ChatSession | null>(`/papers/${paperId}/chat`),

  getSession: (sessionId: number): Promise<ChatSession> =>
    api.get<ChatSession>(`/sessions/${sessionId}`),

  getSessions: (paperId: number): Promise<ChatSession[]> =>
    api.get<ChatSession[]>(`/papers/${paperId}/sessions`),

  createSession: (paperId: number, name?: string): Promise<ChatSession> =>
    api.post<ChatSession>(`/papers/${paperId}/sessions`, name ? { name } : {}),

  updateSession: (sessionId: number, name: string): Promise<ChatSession> =>
    api.patch<ChatSession>(`/sessions/${sessionId}`, { name }),

  deleteSession: async (sessionId: number): Promise<void> => {
    await api.delete(`/sessions/${sessionId}`);
  },

  clearHistory: async (paperId: number): Promise<void> => {
    await api.delete(`/papers/${paperId}/chat`);
  },

  clearSessionMessages: async (sessionId: number): Promise<void> => {
    await api.delete(`/sessions/${sessionId}/messages`);
  },

  getThreadMessages: (messageId: number): Promise<ChatMessage[]> =>
    api.get<ChatMessage[]>(`/messages/${messageId}/thread`),

  sendThreadMessage: (messageId: number, message: string, references?: ChatReferences): Promise<ThreadResponse> =>
    api.post<ThreadResponse>(`/messages/${messageId}/thread`, {
      message,
      references: references ?? EMPTY_REFS,
    }),
};

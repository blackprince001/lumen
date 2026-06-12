import { api } from './client';
import type { ChatReferences } from './chat';

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

export const multiChatApi = {
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

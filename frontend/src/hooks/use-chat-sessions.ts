import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { chatApi, type ChatSession } from '@/lib/api/chat';

interface UseChatSessionsProps {
  paperId: number;
}

interface UseChatSessionsReturn {
  sessions: ChatSession[];
  currentSessionId: number | null;
  currentSession: ChatSession | undefined;
  messages: ChatSession['messages'];
  isLoading: boolean;
  sessionsLoading: boolean;
  sessionLoading: boolean;
  setCurrentSessionId: (id: number | null) => void;
  switchSession: (id: number) => void;
  createSession: (name?: string) => Promise<ChatSession>;
  deleteSession: (sessionId: number) => Promise<void>;
  renameSession: (sessionId: number, name: string) => Promise<void>;
  clearSessionMessages: (sessionId: number) => Promise<void>;
}

/**
 * Hook to manage chat sessions for a paper.
 * Handles fetching, creating, deleting, and renaming sessions.
 *
 * This is the single source of truth for session management — ChatPanel
 * should use this hook instead of duplicating session logic.
 */
export function useChatSessions({ paperId }: UseChatSessionsProps): UseChatSessionsReturn {
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(null);
  const queryClient = useQueryClient();

  // Fetch all sessions for this paper
  const { data: sessions = [], isLoading: sessionsLoading } = useQuery({
    queryKey: ['chat', 'sessions', paperId],
    queryFn: () => chatApi.getSessions(paperId),
    retry: false,
  });

  // Fetch latest session (only on initial mount when no session is selected)
  const { data: latestSession, isLoading: initialLoading } = useQuery({
    queryKey: ['chat', 'latest', paperId],
    queryFn: () => chatApi.getHistory(paperId),
    retry: false,
    enabled: currentSessionId === null,
  });

  // Fetch specific session history
  const { data: currentSession, isLoading: sessionLoading } = useQuery({
    queryKey: ['chat', 'session', currentSessionId],
    queryFn: () => chatApi.getSession(currentSessionId!),
    enabled: currentSessionId !== null,
    retry: false,
  });

  // Effect to set initial session ID from latest session or first available session
  useEffect(() => {
    if (currentSessionId !== null) return;

    if (latestSession)
    {
      setCurrentSessionId(latestSession.id);
    } else if (!initialLoading && sessions.length > 0)
    {
      setCurrentSessionId(sessions[0].id);
    }
  }, [latestSession, currentSessionId, initialLoading, sessions]);

  // Switch to a different session — clears stale cache to prevent fallback bleed
  const switchSession = useCallback((id: number) => {
    if (id === currentSessionId) return;

    // Remove stale latestSession cache so it can't bleed through during load
    queryClient.removeQueries({ queryKey: ['chat', 'latest', paperId] });

    // Pre-invalidate target session to ensure fresh data
    queryClient.invalidateQueries({ queryKey: ['chat', 'session', id] });

    setCurrentSessionId(id);
  }, [currentSessionId, paperId, queryClient]);

  // Create session mutation
  const createSessionMutation = useMutation({
    mutationFn: (name?: string) => chatApi.createSession(paperId, name || 'New Session'),
    onSuccess: (newSession) => {
      queryClient.invalidateQueries({ queryKey: ['chat', 'sessions', paperId] });
      queryClient.removeQueries({ queryKey: ['chat', 'latest', paperId] });
      setCurrentSessionId(newSession.id);
    },
  });

  // Delete session mutation
  const deleteSessionMutation = useMutation({
    mutationFn: (sessionId: number) => chatApi.deleteSession(sessionId),
    onSuccess: (_, deletedSessionId) => {
      // Remove the deleted session from cache immediately
      queryClient.removeQueries({ queryKey: ['chat', 'session', deletedSessionId] });
      queryClient.removeQueries({ queryKey: ['chat', 'latest', paperId] });
      queryClient.invalidateQueries({ queryKey: ['chat', 'sessions', paperId] });

      if (currentSessionId === deletedSessionId)
      {
        // Switch to first remaining session instead of null to avoid
        // re-triggering latestSession query race
        const remaining = sessions.filter(s => s.id !== deletedSessionId);
        setCurrentSessionId(remaining.length > 0 ? remaining[0].id : null);
      }
    },
  });

  // Rename session mutation
  const renameSessionMutation = useMutation({
    mutationFn: ({ id, name }: { id: number, name: string }) => chatApi.updateSession(id, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat', 'sessions', paperId] });
      queryClient.invalidateQueries({ queryKey: ['chat', 'session', currentSessionId] });
    },
  });

  // Clear session messages mutation
  const clearMessagesMutation = useMutation({
    mutationFn: (sessionId: number) => chatApi.clearSessionMessages(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat', 'session', currentSessionId] });
      queryClient.removeQueries({ queryKey: ['chat', 'latest', paperId] });
    },
  });

  // Derive messages from the current session only — no latestSession fallback
  // to prevent stale data from bleeding through during session switches
  const messages = currentSession?.messages || [];

  return {
    sessions,
    currentSessionId,
    // Only use currentSession — no latestSession fallback that causes stale display
    currentSession: currentSession || undefined,
    messages,
    isLoading: sessionsLoading || initialLoading || sessionLoading,
    sessionsLoading,
    sessionLoading,
    setCurrentSessionId,
    switchSession,
    createSession: async (name?: string) => {
      return createSessionMutation.mutateAsync(name);
    },
    deleteSession: async (sessionId: number) => {
      await deleteSessionMutation.mutateAsync(sessionId);
    },
    renameSession: async (sessionId: number, name: string) => {
      await renameSessionMutation.mutateAsync({ id: sessionId, name });
    },
    clearSessionMessages: async (sessionId: number) => {
      await clearMessagesMutation.mutateAsync(sessionId);
    },
  };
}

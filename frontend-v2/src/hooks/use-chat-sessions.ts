import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { chatApi } from '@/lib/api/chat';
import type { ChatSession } from '@/lib/api/chat';

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
  renameSession: (sessionId: number, name: string) => Promise<ChatSession | void>;
  clearSessionMessages: (sessionId: number) => Promise<void>;
}

export function useChatSessions(paperId: number): UseChatSessionsReturn {
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(null);
  const queryClient = useQueryClient();

  const { data: sessions = [], isLoading: sessionsLoading } = useQuery({
    queryKey: ['chat', 'sessions', paperId],
    queryFn: () => chatApi.getSessions(paperId),
    retry: false,
  });

  const { data: latestSession, isLoading: initialLoading } = useQuery({
    queryKey: ['chat', 'latest', paperId],
    queryFn: () => chatApi.getHistory(paperId),
    retry: false,
    enabled: currentSessionId === null,
  });

  const { data: currentSession, isLoading: sessionLoading } = useQuery({
    queryKey: ['chat', 'session', currentSessionId],
    queryFn: () => chatApi.getSession(currentSessionId!),
    enabled: currentSessionId !== null,
    retry: false,
  });

  // Seed the active session from the latest or first available
  useEffect(() => {
    if (currentSessionId !== null) return;
    if (latestSession) {
      setCurrentSessionId(latestSession.id);
    } else if (!initialLoading && sessions.length > 0) {
      setCurrentSessionId(sessions[0].id);
    }
  }, [latestSession, currentSessionId, initialLoading, sessions]);

  const switchSession = useCallback(
    (id: number) => {
      if (id === currentSessionId) return;
      queryClient.removeQueries({ queryKey: ['chat', 'latest', paperId] });
      queryClient.invalidateQueries({ queryKey: ['chat', 'session', id] });
      setCurrentSessionId(id);
    },
    [currentSessionId, paperId, queryClient]
  );

  const createMutation = useMutation({
    mutationFn: (name?: string) => chatApi.createSession(paperId, name ?? 'New Session'),
    onSuccess: (session) => {
      queryClient.invalidateQueries({ queryKey: ['chat', 'sessions', paperId] });
      queryClient.removeQueries({ queryKey: ['chat', 'latest', paperId] });
      setCurrentSessionId(session.id);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (sessionId: number) => chatApi.deleteSession(sessionId),
    onSuccess: (_, deletedId) => {
      queryClient.removeQueries({ queryKey: ['chat', 'session', deletedId] });
      queryClient.removeQueries({ queryKey: ['chat', 'latest', paperId] });
      queryClient.invalidateQueries({ queryKey: ['chat', 'sessions', paperId] });
      if (currentSessionId === deletedId) {
        const remaining = sessions.filter((s) => s.id !== deletedId);
        setCurrentSessionId(remaining[0]?.id ?? null);
      }
    },
  });

  const renameMutation = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) => chatApi.updateSession(id, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat', 'sessions', paperId] });
      queryClient.invalidateQueries({ queryKey: ['chat', 'session', currentSessionId] });
    },
  });

  const clearMutation = useMutation({
    mutationFn: (sessionId: number) => chatApi.clearSessionMessages(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat', 'session', currentSessionId] });
      queryClient.removeQueries({ queryKey: ['chat', 'latest', paperId] });
    },
  });

  return {
    sessions,
    currentSessionId,
    currentSession,
    messages: currentSession?.messages ?? [],
    isLoading: sessionsLoading || initialLoading || sessionLoading,
    sessionsLoading,
    sessionLoading,
    setCurrentSessionId,
    switchSession,
    createSession: (name) => createMutation.mutateAsync(name),
    deleteSession: (id) => deleteMutation.mutateAsync(id),
    renameSession: (id, name) => renameMutation.mutateAsync({ id, name }),
    clearSessionMessages: (id) => clearMutation.mutateAsync(id),
  };
}

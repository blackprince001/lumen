import { useState, useRef, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useChatSessions } from '@/hooks/use-chat-sessions';
import { useChatStream } from '@/hooks/use-chat-stream';
import { type ChatMessage, type ChatReferences } from '@/lib/api/chat';
import { useConfirmDialog } from '@/components/ConfirmDialog';
import { toastError, toastSuccess } from '@/lib/utils/toast';

/**
 * Owns all state and behaviour for a paper chat: sessions, streaming, the
 * composer, threads, and the optimistic cache. Both the compact `ChatTab`
 * and the full-page `PaperChat` view consume this so the two never drift.
 */
export function useChatController(paperId: number) {
  const queryClient = useQueryClient();
  const {
    sessions,
    currentSessionId,
    messages,
    isLoading,
    setCurrentSessionId,
    switchSession,
    createSession,
    deleteSession,
    renameSession,
  } = useChatSessions(paperId);

  const [input, setInput] = useState('');
  const [references, setReferences] = useState<ChatReferences>({ notes: [], annotations: [], papers: [] });
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [activeThreadId, setActiveThreadId] = useState<number | null>(null);
  const [activeProviderId, setActiveProviderId] = useState<number | null>(null);

  const { confirm, dialogProps } = useConfirmDialog();

  const stream = useChatStream();
  const {
    status,
    content,
    sessionId: responseSessionId,
    send,
    cancel,
    isActive,
  } = stream;

  // Toast on streaming errors
  useEffect(() => {
    if (stream.error && !isActive) {
      toastError(
        stream.error.code === 'no_provider'
          ? 'AI provider not configured'
          : stream.error.message || 'Chat error',
      );
    }
  }, [stream.error, isActive]);

  // Abort mid-stream when session switches
  useEffect(() => {
    if (isActive) cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSessionId]);

  // Adopt the session ID assigned by the backend on a fresh conversation
  useEffect(() => {
    if (status === 'done' && currentSessionId == null && responseSessionId) {
      setCurrentSessionId(responseSessionId);
    }
  }, [status, currentSessionId, responseSessionId, setCurrentSessionId]);

  // Hold onto the last sent message/refs so the optimistic cache can use them
  const lastUserMessageRef = useRef<string | null>(null);
  const lastReferencesRef = useRef<ChatReferences | null>(null);

  // Optimistic cache update once a turn completes
  useEffect(() => {
    if (status === 'done' && content && lastUserMessageRef.current) {
      const finalSessionId = responseSessionId || currentSessionId;
      if (finalSessionId) {
        queryClient.setQueryData(['chat', 'session', finalSessionId], (oldSession: any) => {
          if (!oldSession) return oldSession;
          const newUserMsg: ChatMessage = {
            id: Date.now(),
            session_id: finalSessionId,
            role: 'user',
            content: lastUserMessageRef.current || '',
            references: lastReferencesRef.current || { notes: [], annotations: [], papers: [] },
            created_at: new Date().toISOString(),
            parent_message_id: null,
            thread_count: 0,
          };
          const newAssistantMsg: ChatMessage = {
            id: Date.now() + 1,
            session_id: finalSessionId,
            role: 'assistant',
            content,
            created_at: new Date().toISOString(),
            parent_message_id: null,
            thread_count: 0,
          };
          return { ...oldSession, messages: [...(oldSession.messages || []), newUserMsg, newAssistantMsg] };
        });
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ['chat', 'session', finalSessionId] });
          queryClient.invalidateQueries({ queryKey: ['chat', 'sessions', paperId] });
        }, 100);
      }
      lastUserMessageRef.current = null;
      lastReferencesRef.current = null;
    }
  }, [status, content, currentSessionId, responseSessionId, paperId, queryClient]);

  const handleSend = useCallback(() => {
    if (!input.trim() || isActive) return;

    const userMessage = input.trim();
    const userReferences = { ...references };

    lastUserMessageRef.current = userMessage;
    lastReferencesRef.current = userReferences;

    setInput('');
    setReferences({ notes: [], annotations: [], papers: [] });

    send(
      paperId,
      userMessage,
      userReferences,
      currentSessionId || undefined,
      activeProviderId ?? undefined,
    );
  }, [input, references, isActive, send, paperId, currentSessionId, activeProviderId]);

  const handleCreateSession = useCallback(async () => {
    if (isCreatingSession) return;
    setIsCreatingSession(true);
    try {
      await createSession();
      toastSuccess('New session created');
    } catch {
      toastError('Failed to create session');
    } finally {
      setIsCreatingSession(false);
    }
  }, [isCreatingSession, createSession]);

  const handleDeleteSession = useCallback(async (id: number) => {
    const ok = await confirm({
      title: 'Delete Session',
      description: 'Are you sure you want to delete this chat session? This cannot be undone.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (ok) await deleteSession(id);
  }, [confirm, deleteSession]);

  const copyMessage = useCallback((text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  return {
    paperId,
    // sessions
    sessions,
    currentSessionId,
    switchSession,
    renameSession,
    handleCreateSession,
    handleDeleteSession,
    isCreatingSession,
    // messages
    messages,
    isLoading,
    // streaming surface (full object for ChatMessageList)
    stream,
    // composer
    input,
    setInput,
    references,
    setReferences,
    activeProviderId,
    setActiveProviderId,
    handleSend,
    // threads
    activeThreadId,
    setActiveThreadId,
    // misc
    copiedId,
    copyMessage,
    confirmDialogProps: dialogProps,
  };
}

export type ChatController = ReturnType<typeof useChatController>;

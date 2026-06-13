import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Add as Plus, Edit as Edit2, TickCircle as Check, CloseCircle as X, MagicStar as Sparkles, Copy, Message as MessageSquare, ArrowDown, ArrowUp, ArrowDown2, Eye, Microscope, Lamp as Lightbulb } from 'iconsax-reactjs';
import { useQueryClient } from '@tanstack/react-query';
import { useChatSessions } from '@/hooks/use-chat-sessions';
import { useChatStream } from '@/hooks/use-chat-stream';
import { type ChatMessage, type ChatReferences } from '@/lib/api/chat';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { MarkdownMessage } from '@/components/MarkdownMessage';
import { ConfirmDialog, useConfirmDialog } from '@/components/ConfirmDialog';
import { ExpandedInput } from '@/components/ExpandedInput';
import { MessageThread } from '@/components/MessageThread';
import { StreamingMessage } from '@/components/ai/StreamingMessage';
import { MessageAuthor } from '@/components/ai/MessageAuthor';
import { ProviderPicker } from '@/components/ai/ProviderPicker';
import { defaultPrompts } from '@/lib/constants/defaultPrompts';
import { cn } from '@/lib/utils';
import { toastError, toastSuccess } from '@/lib/utils/toast';
import { format } from 'date-fns';
import type { PromptGroup } from '@/components/ExpandedInput';

const CHAT_PROMPT_GROUPS: PromptGroup[] = [
  {
    label: 'Comprehension',
    icon: Eye,
    prompts: defaultPrompts
      .filter(p => ['summarize', 'eli5', 'initial-screen'].includes(p.id))
      .map(p => ({ icon: p.icon, text: p.label, prompt: p.content })),
  },
  {
    label: 'Scrutiny',
    icon: Microscope,
    prompts: defaultPrompts
      .filter(p => ['critique', 'deep-dive', 'figures-breakdown', 'landscape'].includes(p.id))
      .map(p => ({ icon: p.icon, text: p.label, prompt: p.content })),
  },
  {
    label: 'Deep Knowledge',
    icon: Lightbulb,
    prompts: defaultPrompts
      .filter(p => ['claims-evidence', 'citation-radar', 'reproducibility', 'future-work', 'synthesis'].includes(p.id))
      .map(p => ({ icon: p.icon, text: p.label, prompt: p.content })),
  },
];

interface ChatTabProps {
  paperId: number;
}

export function ChatTab({ paperId }: ChatTabProps) {
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
  const [editingSessionId, setEditingSessionId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [activeThreadId, setActiveThreadId] = useState<number | null>(null);
  const [sessionsCollapsed, setSessionsCollapsed] = useState(false);
  const [activeProviderId, setActiveProviderId] = useState<number | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesTopRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [showScrollUp, setShowScrollUp] = useState(false);
  const { confirm, dialogProps } = useConfirmDialog();

  const {
    status,
    content,
    displayedContent,
    toolCalls,
    toolResults,
    thoughts,
    currentTool,
    error,
    messageId,
    sessionId: responseSessionId,
    send,
    cancel,
    retry,
    reset,
    isActive,
    pendingUserMessage,
  } = useChatStream();

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const scrollToTop = useCallback(() => {
    messagesTopRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const handleScroll = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    setShowScrollDown(scrollHeight - scrollTop - clientHeight > 100);
    setShowScrollUp(scrollTop > 100);
  }, []);

  // Auto-scroll when streaming
  useEffect(() => {
    if (isActive || pendingUserMessage) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [displayedContent, pendingUserMessage, isActive]);

  // Scroll to top when session changes
  useEffect(() => {
    messagesTopRef.current?.scrollIntoView({ behavior: 'instant' });
  }, [currentSessionId]);

  // Abort mid-stream when session switches
  useEffect(() => {
    if (isActive) {
      cancel();
    }
  }, [currentSessionId]);

  // Toast on streaming errors
  useEffect(() => {
    if (error && !isActive) {
      toastError(error.code === 'no_provider' ? 'AI provider not configured' : error.message || 'Chat error');
    }
  }, [error, isActive]);

  // Set session ID from response when starting fresh
  useEffect(() => {
    if (status === 'done' && currentSessionId == null) {
      if (responseSessionId) {
        setCurrentSessionId(responseSessionId);
      }
    }
  }, [status, currentSessionId, responseSessionId, setCurrentSessionId]);

  // Optimistic cache after done
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

  // Hold onto the last sent message and refs for optimistic cache
  const lastUserMessageRef = useRef<string | null>(null);
  const lastReferencesRef = useRef<ChatReferences | null>(null);

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

  const handleCreateSession = async () => {
    if (isCreatingSession) return;
    setIsCreatingSession(true);
    try {
      await createSession();
      toastSuccess('New session created');
    } catch (err) {
      toastError('Failed to create session');
    } finally {
      setIsCreatingSession(false);
    }
  };

  const handleDeleteSession = async (id: number) => {
    const ok = await confirm({
      title: 'Delete Session',
      description: 'Are you sure you want to delete this chat session? This cannot be undone.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (ok) await deleteSession(id);
  };

  const startRename = (id: number, name: string) => {
    setEditingSessionId(id);
    setEditName(name);
  };

  const saveRename = async () => {
    if (editingSessionId && editName.trim()) {
      await renameSession(editingSessionId, editName.trim());
      setEditingSessionId(null);
    }
  };

  const cancelRename = () => {
    setEditingSessionId(null);
    setEditName('');
  };

  const copyMessage = (content: string, id: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Skeleton className="w-12 h-12 rounded-full" />
      </div>
    );
  }

  return (
    <>
      <div ref={containerRef} className="flex flex-col h-full relative">
        {/* Session pills */}
        <div className="shrink-0 border-b border-(--border) bg-(--card)">
          <div className="flex items-center gap-1.5 p-2 overflow-x-auto scrollbar-none">
            {/* Collapse toggle */}
            {sessions.length > 1 && (
              <button
                onClick={() => setSessionsCollapsed(!sessionsCollapsed)}
                className="shrink-0 flex items-center justify-center w-6 h-6 rounded-full hover:bg-(--muted) text-(--muted-foreground) transition-colors"
                title={sessionsCollapsed ? 'Show all sessions' : 'Collapse sessions'}
              >
                <ArrowDown2
                  size={12}
                  className={cn('transition-transform', sessionsCollapsed && '-rotate-90')}
                />
              </button>
            )}

            {sessions.length === 0 ? (
              <span className="text-caption text-(--muted-foreground) px-1">No sessions</span>
            ) : (
              sessions.map((s) => {
                const isActive = s.id === currentSessionId;
                if (sessionsCollapsed && !isActive) return null;

                if (editingSessionId === s.id) {
                  return (
                    <div key={s.id} className="flex items-center gap-1 shrink-0">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-28 h-7 px-2 text-caption bg-(--white) border border-(--border) rounded-full"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveRename();
                          if (e.key === 'Escape') cancelRename();
                        }}
                      />
                      <button onClick={saveRename} className="text-(--success) hover:opacity-70 shrink-0">
                        <Check size={12} />
                      </button>
                      <button onClick={cancelRename} className="text-(--muted-foreground) hover:opacity-70 shrink-0">
                        <X size={12} />
                      </button>
                    </div>
                  );
                }

                return (
                  <button
                    key={s.id}
                    onClick={() => switchSession(s.id)}
                    className={cn(
                      'shrink-0 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-caption transition-all duration-150 whitespace-nowrap',
                      'border',
                      isActive
                        ? 'bg-(--foreground) text-(--card) border-(--foreground) font-medium'
                        : 'bg-(--card) text-(--muted-foreground) border-(--border) hover:text-(--foreground) hover:border-(--foreground)/30',
                    )}
                  >
                    <span className="max-w-28 truncate">{s.name}</span>
                    {isActive && (
                      <span className="flex items-center gap-0.5 ml-0.5">
                        <button
                          onClick={(e) => { e.stopPropagation(); startRename(s.id, s.name); }}
                          className="opacity-60 hover:opacity-100 transition-opacity"
                        >
                          <Edit2 size={10} />
                        </button>
                        {sessions.length > 1 && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteSession(s.id); }}
                            className="opacity-60 hover:opacity-100 transition-opacity"
                          >
                            <X size={10} />
                          </button>
                        )}
                      </span>
                    )}
                  </button>
                );
              })
            )}

            {/* New session button */}
            <button
              onClick={handleCreateSession}
              disabled={isCreatingSession}
              className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full border border-dashed border-(--border) text-(--muted-foreground) hover:text-(--foreground) hover:border-(--foreground)/30 transition-colors"
              title="New session"
            >
              <Plus size={12} />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div
          ref={messagesContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-4 space-y-0.5 relative"
        >
          <div ref={messagesTopRef} />
          {messages.length === 0 && !isActive && !pendingUserMessage && (
            <div className="flex flex-col items-center justify-center h-full text-center text-(--muted-foreground) opacity-50">
              <Sparkles size={32} className="mb-3" />
              <p className="text-code">Start a conversation about this paper</p>
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id}>
              <div className="flex justify-start">
                <div className="group relative w-full px-3 py-2.5 rounded-xl bg-transparent transition-colors hover:bg-(--muted)/40">
                  <MessageAuthor role={msg.role === 'user' ? 'user' : 'assistant'} />
                  {msg.role === 'user' ? (
                    <p className="text-code leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                  ) : (
                    <>
                      <MarkdownMessage content={msg.content} />
                      <div className="absolute -bottom-5 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-(--card) border border-(--border) p-1 rounded-md z-10">
                        <Button
                          variant="ghost"
                          className="h-6! w-6! p-0!"
                          onClick={() => copyMessage(msg.content, `${msg.id}-copy`)}
                          title="Copy"
                        >
                          {copiedId === `${msg.id}-copy` ? <Check size={12} className="text-(--success)" /> : <Copy size={12} />}
                        </Button>
                        <Button
                          variant="ghost"
                          className="h-6! w-6! p-0!"
                          onClick={() => setActiveThreadId(activeThreadId === msg.id ? null : msg.id)}
                          title="Reply in thread"
                        >
                          <MessageSquare size={12} />
                        </Button>
                      </div>
                    </>
                  )}
                  <span className="absolute top-2.5 right-2 text-[0.625rem] text-(--muted-foreground) opacity-0 group-hover:opacity-60 transition-opacity pointer-events-none">
                    {format(new Date(msg.created_at), 'MMM d, h:mm a')}
                  </span>
                </div>
              </div>

              {msg.role === 'assistant' && (msg.thread_count > 0 || activeThreadId === msg.id) && (
                <div className="ml-4 mt-2">
                  <MessageThread
                    parentMessage={msg}
                    showInput={activeThreadId === msg.id}
                    onCloseInput={() => setActiveThreadId(null)}
                  />
                </div>
              )}
            </div>
          ))}

          {/* Pending user message */}
          {pendingUserMessage && (
            <div className="flex justify-start">
              <div className="relative w-full px-3 py-2.5 rounded-xl bg-transparent">
                <MessageAuthor role="user" />
                <p className="text-code leading-relaxed whitespace-pre-wrap">{pendingUserMessage}</p>
              </div>
            </div>
          )}

          {/* Streaming response */}
          {isActive && (
            <StreamingMessage
              state={{
                status,
                content,
                displayedContent,
                toolCalls,
                toolResults,
                thoughts,
                currentTool,
                error,
                messageId,
                sessionId: responseSessionId,
              }}
              isStreaming={isActive}
              onRetry={retry}
              onDismiss={reset}
            />
          )}

          {/* Error state after streaming (not during) */}
          {!isActive && error && (
            <div className="mt-2 px-4">
              {/* ErrorBanner is rendered inside StreamingMessage; this is for errors without active stream */}
            </div>
          )}

          {/* Scroll navigation buttons */}
          {(showScrollUp || showScrollDown) && (
            <div className="absolute right-4 top-4 flex flex-col gap-1.5 z-20">
              {showScrollUp && (
                <button
                  onClick={scrollToTop}
                  className="w-8 h-8 rounded-full bg-(--card) border border-(--border) flex items-center justify-center text-(--muted-foreground) hover:text-(--foreground) hover:border-(--foreground)/30 transition-colors"
                  title="Scroll to top"
                >
                  <ArrowUp size={14} />
                </button>
              )}
              {showScrollDown && (
                <button
                  onClick={scrollToBottom}
                  className="w-8 h-8 rounded-full bg-(--card) border border-(--border) flex items-center justify-center text-(--muted-foreground) hover:text-(--foreground) hover:border-(--foreground)/30 transition-colors"
                  title="Scroll to bottom"
                >
                  <ArrowDown size={14} />
                </button>
              )}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-(--border) p-3 shrink-0">
          <div className="mb-2 flex justify-end">
            <ProviderPicker
              value={activeProviderId}
              onChange={setActiveProviderId}
              className="max-w-56"
            />
          </div>
          <ExpandedInput
            value={input}
            onChange={setInput}
            onSubmit={handleSend}
            placeholder="Ask about this paper... (use @ to mention notes/annotations/papers)"
            submitLabel="Send"
            submitIcon={<Send size={14} />}
            disabled={isActive}
            mentionPaperId={paperId}
            onMentionSelect={(mention) => {
              const refKey = `${mention.type}s` as 'notes' | 'annotations' | 'papers';
              setReferences(prev => ({
                ...prev,
                [refKey]: [...(prev[refKey] || []), { id: mention.id, type: mention.type }]
              }));
            }}
            promptsCollapsible
            promptGroups={CHAT_PROMPT_GROUPS}
            onSuggestionClick={(prompt) => {
              setInput(prompt);
            }}
          />
          <p className="text-caption text-(--muted-foreground) px-1 mt-2">
            Press Enter to send, Shift+Enter for newline
          </p>
        </div>
      </div>

      <ConfirmDialog {...dialogProps} />
    </>
  );
}

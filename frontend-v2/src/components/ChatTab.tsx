import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Add as Plus, Trash as Trash2, Edit as Edit2, TickCircle as Check, CloseCircle as X, MagicStar as Sparkles, Copy, Message as MessageSquare, ArrowDown, ArrowUp } from 'iconsax-reactjs';
import { useQueryClient } from '@tanstack/react-query';
import { useChatSessions } from '@/hooks/use-chat-sessions';
import { chatApi, type ChatMessage, type ChatReferences } from '@/lib/api/chat';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { MarkdownMessage } from '@/components/MarkdownMessage';
import { ConfirmDialog, useConfirmDialog } from '@/components/ConfirmDialog';
import { MentionAutocomplete } from '@/components/MentionAutocomplete';
import { MessageThread } from '@/components/MessageThread';
import { defaultPrompts } from '@/lib/constants/defaultPrompts';
import { cn } from '@/lib/utils';
import { toastError, toastSuccess } from '@/lib/utils/toast';
import { format } from 'date-fns';

interface ChatTabProps {
  paperId: number;
}

export function ChatTab({ paperId }: ChatTabProps) {
  const queryClient = useQueryClient();
  const {
    sessions,
    currentSessionId,
    currentSession,
    messages,
    isLoading,
    setCurrentSessionId,
    switchSession,
    createSession,
    deleteSession,
    renameSession,
    clearSessionMessages,
  } = useChatSessions(paperId);

  const [input, setInput] = useState('');
  const [references, setReferences] = useState<ChatReferences>({ notes: [], annotations: [], papers: [] });
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [displayContent, setDisplayContent] = useState('');
  const [pendingUserMessage, setPendingUserMessage] = useState<{ content: string; references: ChatReferences } | null>(null);
  const [editingSessionId, setEditingSessionId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [showPrompts, setShowPrompts] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [activeThreadId, setActiveThreadId] = useState<number | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesTopRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const displayIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isStreamingRef = useRef(false);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [showScrollUp, setShowScrollUp] = useState(false);
  const { confirm, dialogProps } = useConfirmDialog();

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

  // Smooth word-by-word streaming reveal (12 words/second)
  const WORDS_PER_SECOND = 12;
  const WORD_REVEAL_DELAY_MS = 1000 / WORDS_PER_SECOND;

  useEffect(() => {
    if (streamingContent.length > displayContent.length) {
      if (displayIntervalRef.current) clearInterval(displayIntervalRef.current);

      displayIntervalRef.current = setInterval(() => {
        setDisplayContent(prev => {
          if (prev.length >= streamingContent.length) {
            if (displayIntervalRef.current) {
              clearInterval(displayIntervalRef.current);
              displayIntervalRef.current = null;
            }
            return prev;
          }

          const remainingContent = streamingContent.slice(prev.length);
          const wordMatch = remainingContent.match(/^(\s*\S+)/);
          return wordMatch ? prev + wordMatch[1] : streamingContent;
        });
      }, WORD_REVEAL_DELAY_MS);
    }

    return () => {
      if (displayIntervalRef.current) {
        clearInterval(displayIntervalRef.current);
        displayIntervalRef.current = null;
      }
    };
  }, [streamingContent, displayContent.length]);

  // Auto-scroll to bottom only when streaming/sending
  useEffect(() => {
    if (isStreaming || pendingUserMessage) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [displayContent, pendingUserMessage, isStreaming]);

  // Scroll to top when session changes
  useEffect(() => {
    messagesTopRef.current?.scrollIntoView({ behavior: 'instant' });
  }, [currentSessionId]);

  // Reset state on session change (unless streaming)
  useEffect(() => {
    if (!isStreamingRef.current) {
      setPendingUserMessage(null);
      setStreamingContent('');
      setDisplayContent('');
      setIsStreaming(false);
    }
  }, [currentSessionId]);

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return;

    const userMessage = input.trim();
    const userReferences = { ...references };

    setPendingUserMessage({ content: userMessage, references: userReferences });
    setInput('');
    setReferences({ notes: [], annotations: [], papers: [] });
    setIsStreaming(true);
    isStreamingRef.current = true;
    setStreamingContent('');
    setDisplayContent('');

    let accumulatedResponse = '';

    try {
      for await (const chunk of chatApi.streamMessage(paperId, userMessage, userReferences, currentSessionId || undefined)) {
        if (chunk.type === 'chunk' && chunk.content) {
          accumulatedResponse += chunk.content;
          setStreamingContent(prev => prev + chunk.content);
        } else if (chunk.type === 'done') {
          const finalSessionId = chunk.session_id || currentSessionId;

          // Wait for reveal to complete
          await new Promise<void>(resolve => {
            const checkInterval = setInterval(() => {
              setDisplayContent(currentDisplay => {
                if (currentDisplay.length >= accumulatedResponse.length) {
                  clearInterval(checkInterval);
                  resolve();
                }
                return currentDisplay;
              });
            }, 100);
            setTimeout(() => { clearInterval(checkInterval); resolve(); }, 60000);
          });

          // Optimistic cache update
          if (finalSessionId) {
            queryClient.setQueryData(['chat', 'session', finalSessionId], (oldSession: any) => {
              if (!oldSession) return oldSession;
              const newUserMsg: ChatMessage = {
                id: Date.now(),
                session_id: finalSessionId,
                role: 'user',
                content: userMessage,
                references: userReferences,
                created_at: new Date().toISOString(),
                parent_message_id: null,
                thread_count: 0
              };
              const newAssistantMsg: ChatMessage = {
                id: Date.now() + 1,
                session_id: finalSessionId,
                role: 'assistant',
                content: accumulatedResponse,
                created_at: new Date().toISOString(),
                parent_message_id: null,
                thread_count: 0
              };
              return { ...oldSession, messages: [...(oldSession.messages || []), newUserMsg, newAssistantMsg] };
            });
          }

          isStreamingRef.current = false;
          setStreamingContent('');
          setDisplayContent('');
          setIsStreaming(false);
          setPendingUserMessage(null);

          // If this was a new session, update currentSessionId
          if (!currentSessionId && finalSessionId) {
            setCurrentSessionId(finalSessionId);
          }

          // Background refresh
          setTimeout(() => {
            if (finalSessionId) {
              queryClient.invalidateQueries({ queryKey: ['chat', 'session', finalSessionId] });
            }
            queryClient.invalidateQueries({ queryKey: ['chat', 'sessions', paperId] });
          }, 100);
        } else if (chunk.type === 'error') {
          isStreamingRef.current = false;
          setStreamingContent('');
          setDisplayContent('');
          setIsStreaming(false);
          setPendingUserMessage(null);
          toastError(chunk.error || 'Failed to send message');
        }
      }
    } catch (err) {
      isStreamingRef.current = false;
      setStreamingContent('');
      setDisplayContent('');
      setIsStreaming(false);
      setPendingUserMessage(null);
      toastError('Failed to send message');
    }
  };

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

  const handleClearMessages = async () => {
    if (!currentSessionId) return;
    const ok = await confirm({
      title: 'Clear Messages',
      description: 'Are you sure you want to clear all messages in this session?',
      confirmLabel: 'Clear',
      destructive: true,
    });
    if (ok) await clearSessionMessages(currentSessionId);
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

  const insertPrompt = (content: string) => {
    setInput(content);
    setShowPrompts(false);
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
        {/* Session selector */}
        <div className="shrink-0 border-b border-[var(--border)] p-3 bg-[var(--card)]">
          <div className="flex items-center gap-2 mb-2">
            <select
              value={currentSessionId ?? ''}
              onChange={(e) => switchSession(Number(e.target.value))}
              className="flex-1 h-8 px-2 text-code bg-[var(--white)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-[var(--primary)]"
            >
              {sessions.length === 0 && (
                <option value="">No sessions - send a message to start</option>
              )}
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <Button 
              variant="ghost" 
              className="!h-8 !w-8 !p-0" 
              onClick={handleCreateSession}
              disabled={isCreatingSession}
            >
              <Plus size={14} />
            </Button>
          </div>

          {currentSessionId && (
            <div className="flex items-center gap-2">
              {editingSessionId === currentSessionId ? (
                <>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="flex-1 h-7 px-2 text-caption bg-[var(--white)] border border-[var(--border)] rounded"
                    autoFocus
                  />
                  <button onClick={saveRename} className="text-[var(--success)] hover:opacity-70">
                    <Check size={14} />
                  </button>
                  <button onClick={cancelRename} className="text-[var(--muted-foreground)] hover:opacity-70">
                    <X size={14} />
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => startRename(currentSessionId, currentSession?.name ?? '')}
                    className="text-caption text-[var(--muted-foreground)] hover:text-[var(--foreground)] flex items-center gap-1"
                  >
                    <Edit2 size={12} />
                    Rename
                  </button>
                  <button
                    onClick={handleClearMessages}
                    className="text-caption text-[var(--muted-foreground)] hover:text-[var(--foreground)] flex items-center gap-1"
                  >
                    <Trash2 size={12} />
                    Clear
                  </button>
                  {sessions.length > 1 && (
                    <button
                      onClick={() => handleDeleteSession(currentSessionId)}
                      className="text-caption text-[var(--destructive)] hover:opacity-70 flex items-center gap-1"
                    >
                      <Trash2 size={12} />
                      Delete
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Messages */}
        <div
          ref={messagesContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-4 space-y-0.5 relative"
        >
          <div ref={messagesTopRef} />
          {messages.length === 0 && !isStreaming && !pendingUserMessage && (
            <div className="flex flex-col items-center justify-center h-full text-center text-[var(--muted-foreground)] opacity-50">
              <Sparkles size={32} className="mb-3" />
              <p className="text-code">Start a conversation about this paper</p>
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id}>
              <div className="flex justify-start">
                <div
                  className={cn(
                    'group relative w-full px-4 py-2.5 rounded-b-interactive bg-transparent transition-colors border border-transparent',
                    msg.role === 'user'
                      ? 'hover:bg-[rgba(60,145,230,0.05)] hover:border-[rgba(60,145,230,0.25)]'
                      : 'hover:bg-[rgba(76,255,169,0.06)] hover:border-[rgba(76,255,169,0.3)]'
                  )}
                >
                  {/* Short top accent bar */}
                  <span className={cn(
                    'absolute top-0 left-0 h-[2px] w-10',
                    msg.role === 'user' ? 'bg-[rgba(60,145,230,0.5)]' : 'bg-[rgba(76,255,169,0.5)]'
                  )} />
                  {msg.role === 'user' ? (
                    <p className="text-code leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                  ) : (
                    <>
                      <MarkdownMessage content={msg.content} />
                      <div className="absolute -bottom-6 right-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-[var(--card)] border border-[var(--border)] p-1 rounded-md shadow-sm z-10">
                        <Button
                          variant="ghost"
                          className="!h-6 !w-6 !p-0"
                          onClick={() => copyMessage(msg.content, `${msg.id}-copy`)}
                          title="Copy"
                        >
                          {copiedId === `${msg.id}-copy` ? <Check size={12} className="text-[var(--success)]" /> : <Copy size={12} />}
                        </Button>
                        <Button
                          variant="ghost"
                          className="!h-6 !w-6 !p-0"
                          onClick={() => setActiveThreadId(activeThreadId === msg.id ? null : msg.id)}
                          title="Reply in thread"
                        >
                          <MessageSquare size={12} />
                        </Button>
                      </div>
                    </>
                  )}
                  <span className="absolute bottom-1.5 right-2 text-[10px] text-[var(--muted-foreground)] opacity-0 group-hover:opacity-60 transition-opacity pointer-events-none">
                    {format(new Date(msg.created_at), 'MMM d, h:mm a')}
                  </span>
                </div>
              </div>

              {/* Thread - always show if message has replies or if input is active */}
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
              <div className="relative w-full px-4 py-2.5 rounded-b-interactive bg-transparent border border-transparent">
                <span className="absolute top-0 left-0 h-[2px] w-10 bg-[rgba(60,145,230,0.5)]" />
                <p className="text-code leading-relaxed whitespace-pre-wrap">{pendingUserMessage.content}</p>
              </div>
            </div>
          )}

          {/* Streaming response */}
          {isStreaming && (
            <div className="flex justify-start">
              <div className="relative w-full px-4 py-2.5 rounded-b-interactive bg-transparent border border-transparent">
                <span className="absolute top-0 left-0 h-[2px] w-10 bg-[rgba(76,255,169,0.5)]" />
                {displayContent ? (
                  <MarkdownMessage content={displayContent} />
                ) : (
                  <div className="space-y-2.5 w-72">
                    {/* Word-like skeleton animation */}
                    <div className="flex flex-wrap gap-1.5">
                      <div className="h-3 bg-[var(--muted)] rounded animate-pulse w-12" />
                      <div className="h-3 bg-[var(--muted)] rounded animate-pulse w-16" />
                      <div className="h-3 bg-[var(--muted)] rounded animate-pulse w-8" />
                      <div className="h-3 bg-[var(--muted)] rounded animate-pulse w-20" />
                      <div className="h-3 bg-[var(--muted)] rounded animate-pulse w-14" />
                      <div className="h-3 bg-[var(--muted)] rounded animate-pulse w-10" />
                      <div className="h-3 bg-[var(--muted)] rounded animate-pulse w-24" />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <div className="h-3 bg-[var(--muted)] rounded animate-pulse w-20" />
                      <div className="h-3 bg-[var(--muted)] rounded animate-pulse w-8" />
                      <div className="h-3 bg-[var(--muted)] rounded animate-pulse w-16" />
                      <div className="h-3 bg-[var(--muted)] rounded animate-pulse w-12" />
                      <div className="h-3 bg-[var(--muted)] rounded animate-pulse w-18" />
                      <div className="h-3 bg-[var(--muted)] rounded animate-pulse w-10" />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <div className="h-3 bg-[var(--muted)] rounded animate-pulse w-14" />
                      <div className="h-3 bg-[var(--muted)] rounded animate-pulse w-20" />
                      <div className="h-3 bg-[var(--muted)] rounded animate-pulse w-8" />
                      <div className="h-3 bg-[var(--muted)] rounded animate-pulse w-12" />
                      <div className="h-3 bg-[var(--muted)] rounded animate-pulse w-16" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Scroll navigation buttons */}
        {(showScrollUp || showScrollDown) && (
          <div className="absolute right-4 top-4 flex flex-col gap-1.5 z-20">
            {showScrollUp && (
              <button
                onClick={scrollToTop}
                className="w-8 h-8 rounded-full bg-[var(--card)] border border-[var(--border)] shadow-md flex items-center justify-center text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                title="Scroll to top"
              >
                <ArrowUp size={14} />
              </button>
            )}
            {showScrollDown && (
              <button
                onClick={scrollToBottom}
                className="w-8 h-8 rounded-full bg-[var(--card)] border border-[var(--border)] shadow-md flex items-center justify-center text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                title="Scroll to bottom"
              >
                <ArrowDown size={14} />
              </button>
            )}
          </div>
        )}

        <div ref={messagesEndRef} />
        </div>

        {/* Prompts panel */}
        {showPrompts && (
          <div className="shrink-0 border-t border-[var(--border)] p-3 bg-[var(--card)]">
            <div className="flex items-center justify-between mb-2">
              <p className="text-caption font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
                Quick Prompts
              </p>
              <button onClick={() => setShowPrompts(false)} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
                <X size={14} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {defaultPrompts.map((prompt) => (
                <button
                  key={prompt.id}
                  onClick={() => insertPrompt(prompt.content)}
                  className="text-left p-2 bg-[var(--white)] border border-[var(--border)] rounded-lg hover:border-[var(--primary)] transition-colors"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <prompt.icon size={12} className="text-[var(--muted-foreground)]" />
                    <span className="text-caption font-medium">{prompt.label}</span>
                  </div>
                  <p className="text-micro text-[var(--muted-foreground)]">{prompt.description}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="border-t border-[var(--border)] p-3 shrink-0">
          <MentionAutocomplete
            paperId={paperId}
            value={input}
            onChange={setInput}
            onMentionSelect={(mention) => {
              const refKey = `${mention.type}s` as 'notes' | 'annotations' | 'papers';
              setReferences(prev => ({
                ...prev,
                [refKey]: [...(prev[refKey] || []), { id: mention.id, type: mention.type }]
              }));
            }}
            onSend={handleSend}
            placeholder="Ask about this paper... (use @ to mention notes/annotations/papers)"
            className="w-full"
          />
          <div className="flex items-center justify-between mt-2">
            <p className="text-caption text-[var(--muted-foreground)] px-1">
              Press Enter to send, Shift+Enter for newline
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                className="!h-7 !px-2 text-caption"
                onClick={() => setShowPrompts(!showPrompts)}
              >
                <Sparkles size={12} className="mr-1" />
                Prompts
              </Button>
              <Button
                variant="primary"
                className="!h-7 !px-3 text-caption"
                onClick={handleSend}
                disabled={!input.trim() || isStreaming}
              >
                <Send size={12} className="mr-1" />
                Send
              </Button>
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog {...dialogProps} />
    </>
  );
}

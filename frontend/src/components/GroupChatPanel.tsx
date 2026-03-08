import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { multiChatApi, type MultiChatSession, type MultiChatMessage } from '@/lib/api/multi-chat';

import { MarkdownMessage } from './MarkdownMessage';
import { Button } from './Button';
import { format } from 'date-fns';
import {
  Send, Trash2, FileText, BookOpen, Loader2,
  Maximize2, Minimize2, Sparkles, Plus, MoreVertical,
  Edit2, X, ChevronDown, ChevronUp, Copy, Check, Files
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toastError } from '@/lib/utils/toast';
import { useConfirmDialog } from './ConfirmDialog';

interface GroupChatPanelProps {
  groupId?: number;
  paperIds?: number[];
  groupName?: string;
  onClose?: () => void;
}

// Suggested prompts for multi-paper context
const multiPaperPrompts = [
  {
    id: 'compare',
    label: 'Compare Papers',
    description: 'Compare and contrast the key findings, methods, and conclusions across these papers.',
    content: 'Compare and contrast the key findings, methods, and conclusions across these papers. What are the main similarities and differences?',
    icon: Files,
  },
  {
    id: 'summarize',
    label: 'Summarize All',
    description: 'Provide a unified summary of all the papers in this collection.',
    content: 'Provide a comprehensive summary that covers all the papers in this collection. What are the key themes and takeaways?',
    icon: BookOpen,
  },
  {
    id: 'gaps',
    label: 'Research Gaps',
    description: 'Identify research gaps and opportunities for future work based on these papers.',
    content: 'Analyze these papers collectively and identify any research gaps, unanswered questions, or opportunities for future work.',
    icon: Sparkles,
  },
  {
    id: 'methods',
    label: 'Methods Overview',
    description: 'Compare the methodologies used across these papers.',
    content: 'Compare the research methodologies used across these papers. Which approaches seem most effective and why?',
    icon: FileText,
  },
];

const WORDS_PER_SECOND = 12;
const WORD_REVEAL_DELAY_MS = 1000 / WORDS_PER_SECOND;

export function GroupChatPanel({ groupId, paperIds, groupName, onClose }: GroupChatPanelProps) {
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [streamingContent, setStreamingContent] = useState('');
  const [displayContent, setDisplayContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSuggestedPromptsExpanded, setIsSuggestedPromptsExpanded] = useState(false);
  const [pendingUserMessage, setPendingUserMessage] = useState<{ content: string } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isPapersExpanded, setIsPapersExpanded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const queryClient = useQueryClient();

  const isStreamingRef = useRef(false);
  const streamingSessionIdRef = useRef<number | null>(null);
  const displayIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Query keys
  const sessionsKey = groupId
    ? ['multi-chat', 'sessions', 'group', groupId]
    : ['multi-chat', 'sessions', 'papers', ...(paperIds || [])];
  const latestKey = groupId
    ? ['multi-chat', 'latest', 'group', groupId]
    : ['multi-chat', 'latest', 'papers', ...(paperIds || [])];

  // Fetch sessions
  const { data: sessions = [], isLoading: sessionsLoading } = useQuery({
    queryKey: sessionsKey,
    queryFn: () => {
      if (groupId) return multiChatApi.getGroupSessions(groupId);
      return Promise.resolve([] as MultiChatSession[]);
    },
    retry: false,
  });

  // Fetch latest session
  const { data: latestSession, isLoading: initialLoading } = useQuery({
    queryKey: latestKey,
    queryFn: () => {
      if (groupId) return multiChatApi.getGroupHistory(groupId);
      return Promise.resolve(null);
    },
    retry: false,
    enabled: currentSessionId === null,
  });

  // Set initial session
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

  // Reset state when session changes (but not during streaming)
  useEffect(() => {
    if (isStreamingRef.current)
    {
      streamingSessionIdRef.current = currentSessionId;
      return;
    }
    setPendingUserMessage(null);
    setStreamingContent('');
    setDisplayContent('');
    setIsStreaming(false);
  }, [currentSessionId]);

  // Fetch current session
  const { data: currentSession, isLoading: sessionLoading } = useQuery({
    queryKey: ['multi-chat', 'session', currentSessionId],
    queryFn: () => multiChatApi.getSession(currentSessionId!),
    enabled: currentSessionId !== null,
    retry: false,
  });

  // Create session mutation
  const createSessionMutation = useMutation({
    mutationFn: (name?: string) => {
      if (groupId)
      {
        return multiChatApi.createGroupSession(groupId, name || 'New Session', paperIds);
      }
      // For ad-hoc sessions, we'd need a different approach
      return Promise.reject(new Error('Cannot create session without a group'));
    },
    onSuccess: (newSession) => {
      queryClient.invalidateQueries({ queryKey: sessionsKey });
      queryClient.invalidateQueries({ queryKey: latestKey });
      setCurrentSessionId(newSession.id);
    },
  });

  // Delete session mutation
  const deleteSessionMutation = useMutation({
    mutationFn: (sessionId: number) => multiChatApi.deleteSession(sessionId),
    onSuccess: (_, deletedSessionId) => {
      queryClient.invalidateQueries({ queryKey: sessionsKey });
      queryClient.invalidateQueries({ queryKey: ['multi-chat', 'session', deletedSessionId] });
      queryClient.invalidateQueries({ queryKey: latestKey });

      if (currentSessionId === deletedSessionId)
      {
        setCurrentSessionId(null);
      }
    },
  });

  // Rename session mutation
  const renameSessionMutation = useMutation({
    mutationFn: ({ id, name }: { id: number, name: string }) => multiChatApi.updateSession(id, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sessionsKey });
      queryClient.invalidateQueries({ queryKey: ['multi-chat', 'session', currentSessionId] });
    },
  });

  // Clear messages mutation
  const clearMessagesMutation = useMutation({
    mutationFn: (sessionId: number) => multiChatApi.clearSessionMessages(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['multi-chat', 'session', currentSessionId] });
      queryClient.invalidateQueries({ queryKey: latestKey });
    },
  });

  // Auto-scroll
  const messages = currentSession?.messages || latestSession?.messages || [];
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, displayContent, pendingUserMessage]);

  // Smooth streaming reveal
  useEffect(() => {
    if (streamingContent.length > displayContent.length)
    {
      if (displayIntervalRef.current)
      {
        clearInterval(displayIntervalRef.current);
      }

      displayIntervalRef.current = setInterval(() => {
        setDisplayContent(prev => {
          if (prev.length >= streamingContent.length)
          {
            if (displayIntervalRef.current)
            {
              clearInterval(displayIntervalRef.current);
              displayIntervalRef.current = null;
            }
            return prev;
          }
          const remainingContent = streamingContent.slice(prev.length);
          const wordMatch = remainingContent.match(/^(\s*\S+)/);
          if (wordMatch)
          {
            return prev + wordMatch[1];
          }
          return streamingContent;
        });
      }, WORD_REVEAL_DELAY_MS);
    }

    return () => {
      if (displayIntervalRef.current)
      {
        clearInterval(displayIntervalRef.current);
        displayIntervalRef.current = null;
      }
    };
  }, [streamingContent]);

  // Fullscreen
  const handleFullscreenToggle = useCallback(async () => {
    if (!containerRef.current) return;
    try
    {
      if (!isFullscreen)
      {
        await containerRef.current.requestFullscreen();
      } else
      {
        await document.exitFullscreen();
      }
    } catch
    {
      // ignore
    }
  }, [isFullscreen]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Send message
  const handleSend = async (e?: React.FormEvent, content?: string) => {
    e?.preventDefault();
    const messageToSend = content || message;

    if (messageToSend.trim() && !isStreaming)
    {
      const userMessage = messageToSend;

      setPendingUserMessage({ content: userMessage });
      setMessage('');
      setIsStreaming(true);
      isStreamingRef.current = true;
      streamingSessionIdRef.current = currentSessionId;
      setStreamingContent('');

      let accumulatedResponse = '';

      try
      {
        // Choose streaming method based on context type
        const streamFn = groupId
          ? multiChatApi.streamGroupMessage(groupId, userMessage, undefined, currentSessionId || undefined)
          : multiChatApi.streamMultiMessage(paperIds || [], userMessage, undefined, currentSessionId || undefined);

        for await (const chunk of streamFn)
        {
          if (chunk.type === 'chunk' && chunk.content)
          {
            accumulatedResponse += chunk.content;
            setStreamingContent(prev => prev + chunk.content);
          } else if (chunk.type === 'done')
          {
            const finalSessionId = chunk.session_id || currentSessionId;
            const fullResponse = accumulatedResponse;

            // Wait for reveal to complete
            await new Promise<void>((resolve) => {
              const checkInterval = setInterval(() => {
                setDisplayContent(currentDisplay => {
                  if (currentDisplay.length >= fullResponse.length)
                  {
                    clearInterval(checkInterval);
                    resolve();
                  }
                  return currentDisplay;
                });
              }, 100);
              setTimeout(() => { clearInterval(checkInterval); resolve(); }, 60000);
            });

            // Update cache
            if (finalSessionId)
            {
              queryClient.setQueryData<MultiChatSession>(
                ['multi-chat', 'session', finalSessionId],
                (oldSession) => {
                  if (!oldSession) return oldSession;
                  const newUserMsg: MultiChatMessage = {
                    id: Date.now(),
                    session_id: finalSessionId,
                    role: 'user',
                    content: userMessage,
                    created_at: new Date().toISOString(),
                    parent_message_id: null,
                    thread_count: 0,
                  };
                  const newAssistantMsg: MultiChatMessage = {
                    id: Date.now() + 1,
                    session_id: finalSessionId,
                    role: 'assistant',
                    content: fullResponse,
                    created_at: new Date().toISOString(),
                    parent_message_id: null,
                    thread_count: 0,
                  };
                  return {
                    ...oldSession,
                    messages: [...(oldSession.messages || []), newUserMsg, newAssistantMsg],
                  };
                }
              );
            }

            isStreamingRef.current = false;
            streamingSessionIdRef.current = null;
            setStreamingContent('');
            setDisplayContent('');
            setIsStreaming(false);
            setPendingUserMessage(null);

            if (chunk.session_id && currentSessionId === null)
            {
              setCurrentSessionId(chunk.session_id);
            }

            setTimeout(() => {
              if (finalSessionId)
              {
                queryClient.invalidateQueries({ queryKey: ['multi-chat', 'session', finalSessionId] });
              }
              queryClient.invalidateQueries({ queryKey: sessionsKey });
              queryClient.invalidateQueries({ queryKey: latestKey });
            }, 100);
          } else if (chunk.type === 'error')
          {
            isStreamingRef.current = false;
            streamingSessionIdRef.current = null;
            setStreamingContent('');
            setDisplayContent('');
            setIsStreaming(false);
            setPendingUserMessage(null);
            toastError(`Error: ${chunk.error || 'Failed to get response'}`);
            queryClient.invalidateQueries({ queryKey: ['multi-chat', 'session', currentSessionId] });
          }
        }
      } catch (error)
      {
        isStreamingRef.current = false;
        streamingSessionIdRef.current = null;
        setStreamingContent('');
        setDisplayContent('');
        setIsStreaming(false);
        setPendingUserMessage(null);
        toastError(`Error: ${error instanceof Error ? error.message : 'Failed to send message'}`);
        queryClient.invalidateQueries({ queryKey: ['multi-chat', 'session', currentSessionId] });
      }
    }
  };

  const handleRename = (id: number, currentName: string) => {
    const newName = window.prompt('Rename session:', currentName);
    if (newName !== null && newName !== currentName && newName.trim() !== "")
    {
      renameSessionMutation.mutate({ id, name: newName });
    }
  };

  const handleClearMessages = useCallback(() => {
    if (currentSessionId)
    {
      confirm(
        'Clear Messages',
        'Clear all messages from this session? This action cannot be undone.',
        () => { clearMessagesMutation.mutate(currentSessionId); },
        { variant: 'default', confirmLabel: 'Clear' }
      );
    }
  }, [currentSessionId, confirm, clearMessagesMutation]);

  // Paper context info from current session or props
  const sessionPapers = currentSession?.papers || latestSession?.papers || [];
  const paperCount = sessionPapers.length || paperIds?.length || 0;

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex flex-col h-full",
        isFullscreen && !onClose && "fixed inset-0 z-50 bg-grayscale-8"
      )}
    >
      <div className="flex flex-col h-full max-w-3xl mx-auto w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-2 border-b border-green-6 flex-shrink-0">
          <div className="flex-1 min-w-0 mr-2">
            <h3 className="text-sm font-semibold text-green-38 truncate">
              {currentSessionId && sessions.find(s => s.id === currentSessionId)?.name || groupName || 'Multi-Paper Chat'}
            </h3>
            {/* Paper count badge */}
            <button
              onClick={() => setIsPapersExpanded(!isPapersExpanded)}
              className="flex items-center gap-1.5 mt-0.5 text-xs text-green-28 hover:text-green-38 transition-colors"
            >
              <Files className="w-3 h-3" />
              <span>{paperCount} paper{paperCount !== 1 ? 's' : ''} as context</span>
              {isPapersExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Select
              value={currentSessionId?.toString() || ""}
              onValueChange={(val: string | null) => {
                if (val && val.trim() !== "")
                {
                  const id = parseInt(val);
                  if (!isNaN(id) && id !== currentSessionId)
                  {
                    setPendingUserMessage(null);
                    setStreamingContent('');
                    setDisplayContent('');
                    setIsStreaming(false);
                    queryClient.invalidateQueries({ queryKey: ['multi-chat', 'session', id] });
                    setCurrentSessionId(id);
                  }
                }
              }}
              disabled={sessionsLoading || isStreaming}
            >
              <SelectTrigger className="h-8 text-xs w-[140px] border-none shadow-none focus:ring-0 px-2 hover:bg-green-4">
                <SelectValue placeholder={sessionsLoading ? "Loading..." : sessions.length === 0 ? "No sessions" : "Select session"} />
              </SelectTrigger>
              <SelectContent>
                {sessions.length === 0 ? (
                  <div className="px-2 py-1.5 text-xs text-green-28">No sessions yet</div>
                ) : (
                  sessions.map((s) => (
                    <SelectItem key={s.id} value={s.id.toString()} className="text-xs group">
                      <div className="flex items-center justify-between w-full pr-1">
                        <span className="flex-1">{s.name}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-red-600 hover:text-red-700 hover:bg-red-50 rounded"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            confirm(
                              'Delete Session',
                              `Delete "${s.name}"? This action cannot be undone.`,
                              () => { deleteSessionMutation.mutate(s.id); },
                              { variant: 'destructive', confirmLabel: 'Delete' }
                            );
                          }}
                          disabled={deleteSessionMutation.isPending || isStreaming}
                          title="Delete session"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const sessionName = `Session ${sessions.length + 1}`;
                  createSessionMutation.mutate(sessionName);
                }}
                disabled={createSessionMutation.isPending || sessionsLoading}
                className="h-7 w-7 p-0 rounded-md"
                title="New Session"
              >
                {createSessionMutation.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Plus className="w-3.5 h-3.5" />
                )}
              </Button>

              {currentSession && currentSession.messages && currentSession.messages.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearMessages}
                  disabled={clearMessagesMutation.isPending || isStreaming}
                  className="h-7 w-7 p-0 rounded-md"
                  title="Clear Messages"
                >
                  {clearMessagesMutation.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <X className="w-3.5 h-3.5" />
                  )}
                </Button>
              )}

              {currentSessionId && sessions.find(s => s.id === currentSessionId) && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 rounded-md" disabled={sessionsLoading}>
                      <MoreVertical className="w-3.5 h-3.5" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-40 p-1" align="start">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start text-xs h-8 px-2"
                      onClick={() => {
                        if (currentSessionId)
                        {
                          const session = sessions.find(s => s.id === currentSessionId);
                          handleRename(currentSessionId, session?.name || 'Session');
                        }
                      }}
                      disabled={renameSessionMutation.isPending}
                    >
                      <Edit2 className="w-3 h-3 mr-2" />
                      {renameSessionMutation.isPending ? 'Renaming...' : 'Rename'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start text-xs h-8 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => {
                        if (currentSessionId)
                        {
                          confirm(
                            'Delete Session',
                            'Delete this session? This action cannot be undone.',
                            () => { deleteSessionMutation.mutate(currentSessionId); },
                            { variant: 'destructive', confirmLabel: 'Delete' }
                          );
                        }
                      }}
                      disabled={deleteSessionMutation.isPending}
                    >
                      <Trash2 className="w-3 h-3 mr-2" />
                      {deleteSessionMutation.isPending ? 'Deleting...' : 'Delete'}
                    </Button>
                  </PopoverContent>
                </Popover>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1">
            {onClose ? (
              <Button variant="ghost" size="sm" onClick={onClose} className="h-8 px-2" title="Close Chat">
                <Minimize2 className="w-4 h-4" />
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={handleFullscreenToggle} className="h-8 px-2" title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}>
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </Button>
            )}
          </div>
        </div>

        {/* Papers context bar (expandable) */}
        {isPapersExpanded && sessionPapers.length > 0 && (
          <div className="border-b border-green-6 px-3 py-2 bg-green-4/50 max-h-32 overflow-y-auto animate-in slide-in-from-top-2 duration-200">
            <div className="space-y-1">
              {sessionPapers.map((paper) => (
                <div key={paper.id} className="flex items-center gap-2 text-xs">
                  {paper.has_file ? (
                    <FileText className="w-3 h-3 text-blue-500 flex-shrink-0" />
                  ) : (
                    <BookOpen className="w-3 h-3 text-green-28 flex-shrink-0" />
                  )}
                  <span className="text-green-38 truncate">{paper.title}</span>
                  {paper.has_file && (
                    <span className="text-[10px] text-blue-600 bg-blue-50 px-1 rounded">PDF</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          <div className="w-full p-4 space-y-4">
            {(initialLoading || sessionLoading || sessionsLoading) ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-green-24" />
              </div>
            ) : (messages.length === 0 && !pendingUserMessage && (currentSessionId === null || sessions.length === 0)) ? (
              <div className="flex flex-col h-full">
                <div className="flex-1 flex flex-col items-center justify-center text-center p-4 space-y-6">
                  <div className="space-y-2">
                    <h3 className="font-semibold text-green-38">Chat with {paperCount} papers</h3>
                    <p className="text-sm text-green-28 max-w-xs mx-auto">
                      Ask questions about all papers in this {groupId ? 'group' : 'selection'}, compare findings, or explore themes across the collection.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl">
                    {multiPaperPrompts.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => handleSend({ preventDefault: () => { } } as React.FormEvent, p.content)}
                        className="flex flex-col items-start p-4 bg-grayscale-8 border border-green-6 rounded-xl hover:border-blue-19 hover:bg-blue-5/30 transition-all text-left group"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <div className="p-2 bg-green-4 rounded-lg group-hover:bg-grayscale-8 text-green-28 group-hover:text-blue-43 transition-colors">
                            <p.icon className="w-4 h-4" />
                          </div>
                          <span className="font-medium text-sm text-green-38">{p.label}</span>
                        </div>
                        <p className="text-xs text-green-28 line-clamp-2">{p.description}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <>
                {messages.filter(msg => msg.parent_message_id === null).map((msg, index) => (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-300",
                      msg.role === 'user' ? 'items-end' : 'items-start'
                    )}
                    style={{ animationDelay: `${Math.min(index * 50, 500)}ms` }}
                  >
                    <div
                      className={cn(
                        "rounded-lg px-4 py-3 transition-all text-sm max-w-[90%] sm:max-w-[85%]",
                        msg.role === 'user'
                          ? 'bg-blue-5 text-green-34'
                          : 'bg-green-4 text-green-38'
                      )}
                    >
                      {msg.role === 'user' ? (
                        <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                      ) : (
                        <div className="relative group/message">
                          <MarkdownMessage content={msg.content} />
                          <div className="absolute -bottom-6 right-0 opacity-0 group-hover/message:opacity-100 transition-opacity flex items-center gap-1 bg-grayscale-8 border border-green-6 p-1 rounded-md shadow-sm z-10">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 hover:bg-green-4"
                              onClick={() => {
                                navigator.clipboard.writeText(msg.content);
                                setCopiedId(`${msg.id}-md`);
                                setTimeout(() => setCopiedId(null), 2000);
                              }}
                              title="Copy as Markdown"
                            >
                              {copiedId === `${msg.id}-md` ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3 text-green-28" />}
                            </Button>
                          </div>
                        </div>
                      )}
                      <div className={cn("text-xs mt-2", msg.role === 'user' ? 'text-gray-600' : 'text-gray-500')}>
                        {format(new Date(msg.created_at), 'HH:mm')}
                      </div>
                    </div>
                  </div>
                ))}

                {/* Pending user message */}
                {pendingUserMessage && (
                  <div className="flex justify-end animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="rounded-lg px-4 py-3 bg-blue-5 text-green-34 text-sm max-w-[90%] sm:max-w-[85%]">
                      <div className="whitespace-pre-wrap break-words">{pendingUserMessage.content}</div>
                      <div className="text-xs mt-2 text-green-28">{format(new Date(), 'HH:mm')}</div>
                    </div>
                  </div>
                )}

                {/* Streaming response */}
                {isStreaming && (
                  <div className="flex justify-start animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="rounded-lg px-4 py-3 bg-green-4 text-green-38 text-sm max-w-[90%] sm:max-w-[85%]">
                      {displayContent ? (
                        <MarkdownMessage content={displayContent} />
                      ) : (
                        <div className="space-y-2.5 w-72">
                          <div className="flex flex-wrap gap-1.5">
                            <div className="h-3 bg-green-6 rounded animate-pulse w-12" />
                            <div className="h-3 bg-green-6 rounded animate-pulse w-16" />
                            <div className="h-3 bg-green-6 rounded animate-pulse w-8" />
                            <div className="h-3 bg-green-6 rounded animate-pulse w-20" />
                            <div className="h-3 bg-green-6 rounded animate-pulse w-14" />
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            <div className="h-3 bg-green-6 rounded animate-pulse w-20" />
                            <div className="h-3 bg-green-6 rounded animate-pulse w-8" />
                            <div className="h-3 bg-green-6 rounded animate-pulse w-16" />
                            <div className="h-3 bg-green-6 rounded animate-pulse w-12" />
                          </div>
                        </div>
                      )}
                      {displayContent && (
                        <div className="text-xs mt-2 text-green-28 flex items-center gap-1">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>Typing...</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Suggested prompts (collapsible, when messages exist) */}
                {currentSession && messages.length > 0 && !isStreaming && !pendingUserMessage && (
                  <div className="mt-6 pt-4 border-t border-green-6">
                    <button
                      onClick={() => setIsSuggestedPromptsExpanded(!isSuggestedPromptsExpanded)}
                      className="w-full flex items-center justify-between py-2 px-1 hover:bg-green-4 rounded-lg transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-3.5 h-3.5 text-green-24" />
                        <h4 className="text-xs font-semibold text-green-28 uppercase tracking-wide">Suggested Prompts</h4>
                      </div>
                      {isSuggestedPromptsExpanded ? <ChevronUp className="w-4 h-4 text-green-24" /> : <ChevronDown className="w-4 h-4 text-green-24" />}
                    </button>
                    {isSuggestedPromptsExpanded && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3 animate-in fade-in slide-in-from-top-2 duration-200">
                        {multiPaperPrompts.map((p) => (
                          <button
                            key={p.id}
                            onClick={() => handleSend(undefined, p.content)}
                            className="flex flex-col items-start p-3 bg-green-4 border border-green-6 rounded-lg hover:border-blue-19 hover:bg-blue-5/50 transition-all text-left group"
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <div className="p-1.5 bg-grayscale-8 rounded-md group-hover:bg-blue-5 text-green-28 group-hover:text-blue-43 transition-colors">
                                <p.icon className="w-3.5 h-3.5" />
                              </div>
                              <span className="font-medium text-xs text-green-38">{p.label}</span>
                            </div>
                            <p className="text-xs text-green-28 line-clamp-2">{p.description}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input */}
        <div className="border-t border-green-6 relative flex-shrink-0 p-3">
          <div className="w-full">
            <div className="bg-grayscale-8 border border-green-6 rounded-2xl">
              <div className="px-3 pt-3 pb-2 relative">
                <form onSubmit={handleSend}>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey))
                      {
                        e.preventDefault();
                        if (message.trim() && !isStreaming)
                        {
                          handleSend();
                        }
                      }
                    }}
                    placeholder={`Ask about ${paperCount} paper${paperCount !== 1 ? 's' : ''}... (Ctrl+Enter to send)`}
                    className="w-full resize-none bg-transparent text-sm text-green-38 placeholder:text-green-24 focus:outline-none min-h-[40px] max-h-[120px]"
                    rows={1}
                    disabled={isStreaming}
                  />
                </form>
              </div>

              <div className="mb-2 px-2 flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        type="button"
                        className="h-7 w-7 p-0 rounded-full border border-green-6 hover:bg-blue-5 hover:border-blue-19 transition-colors"
                        title="AI Prompts"
                      >
                        <Sparkles className="size-3.5 text-blue-600" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-0" align="start" side="top">
                      <div className="p-2 border-b border-green-6">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-blue-43" />
                          <span className="text-sm font-semibold text-green-38">Suggested Prompts</span>
                        </div>
                        <p className="text-xs text-green-28 mt-1">Multi-paper analysis prompts</p>
                      </div>
                      <div className="grid gap-1 p-1 max-h-80 overflow-y-auto">
                        {multiPaperPrompts.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => handleSend(undefined, p.content)}
                            className="w-full text-left flex items-start gap-3 p-2 rounded-md hover:bg-blue-5 transition-colors border border-transparent hover:border-blue-19"
                          >
                            <div className="mt-0.5 text-blue-43 flex-shrink-0">
                              <p.icon className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-green-38">{p.label}</div>
                              <div className="text-xs text-green-28 line-clamp-2 text-wrap">{p.description}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                <Button
                  type="submit"
                  disabled={!message.trim() || isStreaming}
                  onClick={handleSend}
                  className={cn(
                    "size-7 p-0 rounded-full disabled:opacity-50 disabled:cursor-not-allowed",
                    isStreaming ? "bg-green-24" : "bg-green-38 hover:bg-green-34"
                  )}
                >
                  {isStreaming ? (
                    <Loader2 className="size-3 text-white animate-spin" />
                  ) : (
                    <Send className="size-3 text-white fill-white" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
      {confirmDialog}
    </div>
  );
}

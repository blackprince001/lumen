import { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { chatApi, type ChatMessage } from '@/lib/api/chat';
import { chatStreamClient } from '@/lib/ai/chatStream';
import type { StreamEvent } from '@/lib/ai/chatStream';
import { MarkdownMessage } from './MarkdownMessage';
import { MessageAuthor } from '@/components/ai/MessageAuthor';
import { StreamingMessage } from './ai/StreamingMessage';
import { ExpandedInput } from './ExpandedInput';
import { format } from 'date-fns';
import { Send } from 'iconsax-reactjs';
import { Skeleton } from './ui/Skeleton';
import { logger } from '@/lib/logger';

interface MessageThreadProps {
  parentMessage: ChatMessage;
  showInput?: boolean;
  onCloseInput?: () => void;
}

export function MessageThread({ parentMessage, showInput = false, onCloseInput }: MessageThreadProps) {
  const [message, setMessage] = useState('');
  const [streamState, setStreamState] = useState<{
    status: 'idle' | 'connecting' | 'streaming' | 'thinking' | 'using_tool' | 'done' | 'error';
    content: string;
    displayedContent: string;
    toolCalls: StreamEvent[];
    toolResults: StreamEvent[];
    thoughts: StreamEvent[];
    currentTool: string | null;
    error: { message: string; code: string; recoverable: boolean } | null;
    messageId: number | null;
    sessionId: number | null;
  }>({
    status: 'idle',
    content: '',
    displayedContent: '',
    toolCalls: [],
    toolResults: [],
    thoughts: [],
    currentTool: null,
    error: null,
    messageId: null,
    sessionId: null,
  });

  const [pendingUserMessage, setPendingUserMessage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const queryClient = useQueryClient();
  const isStreaming = streamState.status !== 'idle' && streamState.status !== 'done' && streamState.status !== 'error';

  const { data: threadMessages = [], isLoading } = useQuery({
    queryKey: ['thread', parentMessage.id],
    queryFn: () => chatApi.getThreadMessages(parentMessage.id),
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [threadMessages, streamState.displayedContent, pendingUserMessage]);

  // Word-by-word display
  useEffect(() => {
    if (!isStreaming || !streamState.content) return;
    if (streamState.displayedContent.length >= streamState.content.length) {
      setStreamState((prev) => ({ ...prev, displayedContent: prev.content }));
      return;
    }
    const timer = setTimeout(() => {
      setStreamState((prev) => {
        const remaining = prev.content.slice(prev.displayedContent.length);
        const wordMatch = remaining.match(/^(\s*\S+)/);
        return {
          ...prev,
          displayedContent: wordMatch
            ? prev.displayedContent + wordMatch[1]
            : prev.content,
        };
      });
    }, 1000 / 12);
    return () => clearTimeout(timer);
  }, [streamState.content, streamState.displayedContent, isStreaming]);

  const handleSend = useCallback(async () => {
    if (!message.trim() || isStreaming) return;

    const userMessage = message.trim();
    setPendingUserMessage(userMessage);
    setMessage('');

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStreamState({
      status: 'connecting',
      content: '',
      displayedContent: '',
      toolCalls: [],
      toolResults: [],
      thoughts: [],
      currentTool: null,
      error: null,
      messageId: null,
      sessionId: null,
    });

    try {
      const gen = chatStreamClient.streamThreadMessage(
        parentMessage.id,
        userMessage,
        undefined,
        { signal: controller.signal, timeoutMs: 60_000 },
      );

      for await (const event of gen) {
        if (controller.signal.aborted) break;

        setStreamState((prev) => {
          const next = { ...prev };

          switch (event.type) {
            case 'chunk':
              next.content = prev.content + (event.content || '');
              next.status = 'streaming';
              break;
            case 'tool_call':
              next.toolCalls = [...prev.toolCalls, event];
              next.currentTool = (event.tool as string) || null;
              next.status = 'using_tool';
              break;
            case 'tool_result':
              next.toolResults = [...prev.toolResults, event];
              next.currentTool = null;
              next.status = 'streaming';
              break;
            case 'thought':
              next.thoughts = [...prev.thoughts, event];
              next.status = 'thinking';
              break;
            case 'error':
              next.status = 'error';
              next.error = {
                message: (event.error as string) || 'An error occurred',
                code: (event.error_code as string) || 'internal',
                recoverable: event.recoverable !== false,
              };
              break;
            case 'keepalive':
              break;
            case 'done':
              next.messageId = (event.message_id as number) ?? null;
              next.sessionId = (event.session_id as number) ?? null;
              next.status = 'done';
              break;
          }

          return next;
        });
      }

      // Stream ended without explicit 'done'
      setStreamState((prev) => {
        if (prev.status !== 'done' && prev.status !== 'error') {
          return { ...prev, status: 'done' };
        }
        return prev;
      });

      // Invalidate caches and close input on success
      setStreamState((prev) => {
        if (prev.status === 'done') {
          queryClient.invalidateQueries({ queryKey: ['thread', parentMessage.id] });
          queryClient.invalidateQueries({ queryKey: ['chat', 'session'] });
          onCloseInput?.();
        }
        return prev;
      });
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        setStreamState({
          status: 'idle',
          content: '',
          displayedContent: '',
          toolCalls: [],
          toolResults: [],
          thoughts: [],
          currentTool: null,
          error: null,
          messageId: null,
          sessionId: null,
        });
        return;
      }
      logger.error('Thread stream error:', err);
      setStreamState((prev) => ({
        ...prev,
        status: 'error',
        error: {
          message: (err as Error).message || 'Failed to send message',
          code: 'internal',
          recoverable: true,
        },
      }));
    } finally {
      setPendingUserMessage(null);
    }
  }, [message, isStreaming, parentMessage.id, queryClient, onCloseInput]);

  const handleRetry = useCallback(() => {
    if (!pendingUserMessage) return;
    const msg = pendingUserMessage;
    setPendingUserMessage(null);
    setMessage(msg);
    setTimeout(() => {
      handleSend();
    }, 0);
  }, [pendingUserMessage, handleSend]);

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreamState({
      status: 'idle',
      content: '',
      displayedContent: '',
      toolCalls: [],
      toolResults: [],
      thoughts: [],
      currentTool: null,
      error: null,
      messageId: null,
      sessionId: null,
    });
    setPendingUserMessage(null);
  }, []);

  const threadCount = parentMessage.thread_count || threadMessages.length;

  return (
    <div className="mt-2 ml-4 pl-3 border-l-2 border-(--border)">
      {/* Thread header */}
      {threadCount > 0 && (
        <div className="mb-2 text-caption text-(--muted-foreground) font-medium">
          {threadCount} {threadCount === 1 ? 'reply' : 'replies'}
        </div>
      )}

      {/* Thread messages */}
      <div className="space-y-0.5">
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Skeleton className="w-8 h-8 rounded-full" />
          </div>
        ) : (
          <>
            {threadMessages.map(msg => (
              <div key={msg.id} className="flex justify-start">
                <div className="group relative w-full px-3 py-2 rounded-xl text-caption bg-transparent transition-colors hover:bg-(--muted)/40">
                  <MessageAuthor role={msg.role === 'user' ? 'user' : 'assistant'} />
                  {msg.role === 'user' ? (
                    <div className="whitespace-pre-wrap wrap-break-word">{msg.content}</div>
                  ) : (
                    <MarkdownMessage content={msg.content} />
                  )}
                  <span className="absolute top-2 right-2 text-[0.625rem] text-(--muted-foreground) opacity-0 group-hover:opacity-60 transition-opacity pointer-events-none">
                    {format(new Date(msg.created_at), 'HH:mm')}
                  </span>
                </div>
              </div>
            ))}

            {pendingUserMessage && (
              <div className="flex justify-start">
                <div className="relative w-full px-3 py-2 rounded-xl text-caption bg-transparent">
                  <MessageAuthor role="user" />
                  <div className="whitespace-pre-wrap wrap-break-word">{pendingUserMessage}</div>
                </div>
              </div>
            )}

            {isStreaming && (
              <StreamingMessage
                state={{
                  status: streamState.status as any,
                  content: streamState.content,
                  displayedContent: streamState.displayedContent,
                  toolCalls: streamState.toolCalls.map(e => ({
                    tool: e.tool as string,
                    arguments: (e.arguments as Record<string, unknown>) || {},
                    timestamp: Date.now(),
                  })),
                  toolResults: streamState.toolResults.map(e => ({
                    tool: e.tool as string,
                    result: e.result as string,
                    timestamp: Date.now(),
                  })),
                  thoughts: streamState.thoughts.map(e => ({
                    content: e.content as string,
                    timestamp: Date.now(),
                  })),
                  currentTool: streamState.currentTool,
                  error: streamState.error,
                  messageId: streamState.messageId,
                  sessionId: streamState.sessionId,
                }}
                isStreaming={isStreaming}
                onRetry={handleRetry}
                onDismiss={handleCancel}
              />
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Thread input */}
      {showInput && (
        <div className="mt-2">
          <ExpandedInput
            size="compact"
            value={message}
            onChange={setMessage}
            onSubmit={handleSend}
            placeholder="Reply in thread..."
            disabled={isStreaming}
            submitIcon={<Send size={11} />}
            autoFocus
          />
        </div>
      )}
    </div>
  );
}

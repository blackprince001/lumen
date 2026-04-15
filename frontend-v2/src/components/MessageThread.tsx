import { useState, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { chatApi, type ChatMessage } from '@/lib/api/chat';
import { MarkdownMessage } from './MarkdownMessage';
import { Button } from './ui/Button';
import { format } from 'date-fns';
import { Send } from 'iconsax-reactjs';
import { Skeleton } from './ui/Skeleton';
import { cn } from '@/lib/utils';
import { toastError } from '@/lib/utils/toast';

interface MessageThreadProps {
  parentMessage: ChatMessage;
  showInput?: boolean;
  onCloseInput?: () => void;
}

export function MessageThread({ parentMessage, showInput = false, onCloseInput }: MessageThreadProps) {
  const [message, setMessage] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [displayContent, setDisplayContent] = useState('');
  const [pendingUserMessage, setPendingUserMessage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const displayIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const queryClient = useQueryClient();

  const { data: threadMessages = [], isLoading } = useQuery({
    queryKey: ['thread', parentMessage.id],
    queryFn: () => chatApi.getThreadMessages(parentMessage.id),
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [threadMessages, displayContent, pendingUserMessage]);

  // Word-by-word streaming
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
      }, 83);
    }

    return () => {
      if (displayIntervalRef.current) {
        clearInterval(displayIntervalRef.current);
        displayIntervalRef.current = null;
      }
    };
  }, [streamingContent, displayContent.length]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();

    if (message.trim() && !isStreaming) {
      const userMessage = message;
      setPendingUserMessage(userMessage);
      setMessage('');
      setIsStreaming(true);
      setStreamingContent('');
      setDisplayContent('');

      let accumulatedResponse = '';

      try {
        for await (const chunk of chatApi.streamThreadMessage(parentMessage.id, userMessage)) {
          if (chunk.type === 'chunk' && chunk.content) {
            accumulatedResponse += chunk.content;
            setStreamingContent(prev => prev + chunk.content);
          } else if (chunk.type === 'done') {
            queryClient.invalidateQueries({ queryKey: ['thread', parentMessage.id] });
            queryClient.invalidateQueries({ queryKey: ['chat', 'session'] });
            setStreamingContent('');
            setDisplayContent('');
            setIsStreaming(false);
            setPendingUserMessage(null);
            onCloseInput?.(); // Close input after successful send
          } else if (chunk.type === 'error') {
            setStreamingContent('');
            setDisplayContent('');
            setIsStreaming(false);
            setPendingUserMessage(null);
            toastError(chunk.error || 'Failed to get response');
          }
        }
      } catch (error) {
        setStreamingContent('');
        setDisplayContent('');
        setIsStreaming(false);
        setPendingUserMessage(null);
        toastError('Failed to send message');
      }
    }
  };

  const threadCount = parentMessage.thread_count || threadMessages.length;

  return (
    <div className="mt-2 ml-4 pl-3 border-l-2 border-[var(--border)]">
      {/* Thread header */}
      {threadCount > 0 && (
        <div className="mb-2 text-caption text-[var(--muted-foreground)] font-medium">
          {threadCount} {threadCount === 1 ? 'reply' : 'replies'}
        </div>
      )}

      {/* Thread messages */}
      <div className="space-y-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-4">
                <Skeleton className="w-8 h-8 rounded-full" />
              </div>
            ) : (
              <>
                {threadMessages.map(msg => (
                  <div key={msg.id} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                    <div
                      className={cn(
                        'rounded-lg px-3 py-2 text-caption max-w-[85%]',
                        msg.role === 'user'
                          ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                          : 'bg-[var(--card)] border border-[var(--border)]'
                      )}
                    >
                      {msg.role === 'user' ? (
                        <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                      ) : (
                        <MarkdownMessage content={msg.content} />
                      )}
                      <div className="text-micro mt-1 opacity-60">
                        {format(new Date(msg.created_at), 'HH:mm')}
                      </div>
                    </div>
                  </div>
                ))}

                {pendingUserMessage && (
                  <div className="flex justify-end">
                    <div className="rounded-lg px-3 py-2 text-caption max-w-[85%] bg-[var(--primary)] text-[var(--primary-foreground)]">
                      <div className="whitespace-pre-wrap break-words">{pendingUserMessage}</div>
                      <div className="text-micro mt-1 opacity-60">{format(new Date(), 'HH:mm')}</div>
                    </div>
                  </div>
                )}

                {isStreaming && displayContent && (
                  <div className="flex justify-start">
                    <div className="rounded-lg px-3 py-2 text-caption max-w-[85%] bg-[var(--card)] border border-[var(--border)]">
                      <MarkdownMessage content={displayContent} />
                    </div>
                  </div>
                )}
              </>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Thread input - only show if explicitly requested */}
          {showInput && (
            <form onSubmit={handleSend} className="mt-2 flex gap-2">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Reply in thread..."
                disabled={isStreaming}
                autoFocus
                className="flex-1 px-3 py-1.5 text-caption rounded-md border border-[var(--border)] bg-[var(--white)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:border-[var(--primary)]"
              />
              <Button
                type="submit"
                variant="primary"
                className="!h-7 !w-7 !p-0"
                disabled={!message.trim() || isStreaming}
              >
                <Send size={12} />
              </Button>
            </form>
          )}
    </div>
  );
}

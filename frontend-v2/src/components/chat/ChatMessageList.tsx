import { useRef, useEffect, useState, useCallback } from 'react';
import { MagicStar as Sparkles, Copy, TickCircle as Check, Message as MessageSquare, ArrowDown, ArrowUp } from 'iconsax-reactjs';
import { format } from 'date-fns';
import { Button } from '@/components/ui/Button';
import { MarkdownMessage } from '@/components/MarkdownMessage';
import { MessageThread } from '@/components/MessageThread';
import { StreamingMessage } from '@/components/ai/StreamingMessage';
import { MessageAuthor } from '@/components/ai/MessageAuthor';
import { cn } from '@/lib/utils';
import type { ChatController } from '@/hooks/use-chat-controller';

interface ChatMessageListProps {
  controller: ChatController;
  /** Extra classes for the scroll container. */
  className?: string;
  /** Centres and width-caps the message column (used by the full-page view). */
  centered?: boolean;
}

export function ChatMessageList({ controller, className, centered = false }: ChatMessageListProps) {
  const {
    messages,
    stream,
    activeThreadId,
    setActiveThreadId,
    copiedId,
    copyMessage,
    currentSessionId,
  } = controller;

  const {
    status, content, displayedContent, toolCalls, toolResults, thoughts,
    currentTool, error, messageId, sessionId: responseSessionId,
    retry, reset, isActive, pendingUserMessage,
  } = stream;

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesTopRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  // Whether the view is "stuck" to the bottom. While true, streaming output
  // keeps the latest text in view; once the user scrolls up it goes false and
  // auto-scroll stops until they return to the bottom.
  const pinnedToBottomRef = useRef(true);
  const prevPendingRef = useRef<string | null>(null);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [showScrollUp, setShowScrollUp] = useState(false);

  const scrollToBottom = useCallback(() => {
    pinnedToBottomRef.current = true;
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);
  const scrollToTop = useCallback(() => {
    messagesTopRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const handleScroll = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    pinnedToBottomRef.current = distanceFromBottom < 80;
    setShowScrollDown(distanceFromBottom > 100);
    setShowScrollUp(scrollTop > 100);
  }, []);

  // Sending a new message always snaps back to the bottom.
  useEffect(() => {
    if (pendingUserMessage && pendingUserMessage !== prevPendingRef.current) {
      pinnedToBottomRef.current = true;
    }
    prevPendingRef.current = pendingUserMessage;
  }, [pendingUserMessage]);

  // Auto-scroll while streaming — but only if the user hasn't scrolled up.
  useEffect(() => {
    if ((isActive || pendingUserMessage) && pinnedToBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [displayedContent, pendingUserMessage, isActive]);

  // Jump to top when the session changes
  useEffect(() => {
    messagesTopRef.current?.scrollIntoView({ behavior: 'instant' });
  }, [currentSessionId]);

  const inner = centered ? 'mx-auto w-full max-w-3xl' : '';

  return (
    <div
      ref={messagesContainerRef}
      onScroll={handleScroll}
      data-chat-scroll
      className={cn('flex-1 overflow-y-auto p-4 relative', className)}
    >
      <div ref={messagesTopRef} />
      {messages.length === 0 && !isActive && !pendingUserMessage && (
        <div className="flex flex-col items-center justify-center h-full text-center text-(--muted-foreground) opacity-50">
          <Sparkles size={32} className="mb-3" />
          <p className="text-code">Start a conversation about this paper</p>
        </div>
      )}

      <div className={cn('space-y-0.5', inner)}>
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
              <MessageThread
                parentMessage={msg}
                showInput={activeThreadId === msg.id}
                onCloseInput={() => setActiveThreadId(null)}
              />
            )}
          </div>
        ))}

        {pendingUserMessage && (
          <div className="flex justify-start">
            <div className="relative w-full px-3 py-2.5 rounded-xl bg-transparent">
              <MessageAuthor role="user" />
              <p className="text-code leading-relaxed whitespace-pre-wrap">{pendingUserMessage}</p>
            </div>
          </div>
        )}

        {isActive && (
          <StreamingMessage
            state={{
              status, content, displayedContent, toolCalls, toolResults, thoughts,
              currentTool, error, messageId, sessionId: responseSessionId,
            }}
            isStreaming={isActive}
            onRetry={retry}
            onDismiss={reset}
          />
        )}
      </div>

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
  );
}

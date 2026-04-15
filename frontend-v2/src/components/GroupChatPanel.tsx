import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { multiChatApi } from '@/lib/api/multi-chat';
import { CloseCircle as X, Send, Refresh as Loader2 } from 'iconsax-reactjs';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';

interface GroupChatPanelProps {
  groupId: number;
  groupName: string;
  onClose: () => void;
}

const WORDS_PER_SECOND = 12;
const WORD_REVEAL_DELAY_MS = 1000 / WORDS_PER_SECOND;

export function GroupChatPanel({ groupId, groupName, onClose }: GroupChatPanelProps) {
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [streamingContent, setStreamingContent] = useState('');
  const [displayContent, setDisplayContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [pendingUserMessage, setPendingUserMessage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // Fetch latest session
  const { data: latestSession } = useQuery({
    queryKey: ['multi-chat', 'latest', 'group', groupId],
    queryFn: () => multiChatApi.getGroupHistory(groupId),
    enabled: currentSessionId === null,
  });

  // Set initial session
  useEffect(() => {
    if (currentSessionId === null && latestSession) {
      setCurrentSessionId(latestSession.id);
    }
  }, [latestSession, currentSessionId]);

  // Fetch current session
  const { data: currentSession } = useQuery({
    queryKey: ['multi-chat', 'session', currentSessionId],
    queryFn: () => multiChatApi.getSession(currentSessionId!),
    enabled: currentSessionId !== null,
  });

  // Create session mutation
  const createSessionMutation = useMutation({
    mutationFn: () => multiChatApi.createGroupSession(groupId, 'New Session'),
    onSuccess: (session) => {
      setCurrentSessionId(session.id);
      queryClient.invalidateQueries({ queryKey: ['multi-chat', 'latest', 'group', groupId] });
    },
  });

  // Word-by-word reveal effect
  useEffect(() => {
    if (!isStreaming || !streamingContent) return;

    const words = streamingContent.split(/(\s+)/);
    const displayWords = displayContent.split(/(\s+)/);
    
    if (displayWords.length >= words.length) {
      setDisplayContent(streamingContent);
      return;
    }

    const timer = setTimeout(() => {
      const nextIndex = displayWords.length;
      setDisplayContent(words.slice(0, nextIndex + 1).join(''));
    }, WORD_REVEAL_DELAY_MS);

    return () => clearTimeout(timer);
  }, [streamingContent, displayContent, isStreaming]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentSession?.messages, displayContent, pendingUserMessage]);

  const handleSend = async () => {
    if (!message.trim()) return;

    const userMessage = message.trim();
    setMessage('');
    setPendingUserMessage(userMessage);
    setIsStreaming(true);
    setStreamingContent('');
    setDisplayContent('');

    try {
      // Create session if needed
      let sessionId = currentSessionId;
      if (!sessionId) {
        const session = await createSessionMutation.mutateAsync();
        sessionId = session.id;
      }

      // Stream response
      let fullContent = '';
      for await (const chunk of multiChatApi.streamGroupMessage(groupId, userMessage, undefined, sessionId)) {
        if (chunk.type === 'chunk') {
          fullContent += chunk.content;
          setStreamingContent(fullContent);
        } else if (chunk.type === 'done') {
          setStreamingContent(fullContent);
          setDisplayContent(fullContent);
          setIsStreaming(false);
          setPendingUserMessage(null);
          queryClient.invalidateQueries({ queryKey: ['multi-chat', 'session', sessionId] });
        }
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      setIsStreaming(false);
      setPendingUserMessage(null);
    }
  };

  const messages = currentSession?.messages || [];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
        <div>
          <h2 className="text-body-lg font-medium">{groupName}</h2>
          <p className="text-code text-[var(--muted-foreground)]">
            {currentSession?.papers.length || 0} papers
          </p>
        </div>
        <Button variant="ghost" className="!h-8 !w-8 !p-0" onClick={onClose}>
          <X size={18} />
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              'flex',
              msg.role === 'user' ? 'justify-end' : 'justify-start'
            )}
          >
            <div
              className={cn(
                'max-w-[80%] rounded-lg px-4 py-2 text-body',
                msg.role === 'user'
                  ? 'bg-[var(--primary)] text-white'
                  : 'bg-[var(--muted)] text-[var(--foreground)]'
              )}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {/* Pending user message */}
        {pendingUserMessage && (
          <div className="flex justify-end">
            <div className="max-w-[80%] rounded-lg px-4 py-2 text-body bg-[var(--primary)] text-white">
              {pendingUserMessage}
            </div>
          </div>
        )}

        {/* Streaming assistant message */}
        {isStreaming && displayContent && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-lg px-4 py-2 text-body bg-[var(--muted)] text-[var(--foreground)]">
              {displayContent}
              <span className="inline-block w-1 h-4 ml-1 bg-current animate-pulse" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-6 py-4 border-t border-[var(--border)]">
        <div className="flex items-center gap-2">
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Ask about these papers..."
            disabled={isStreaming}
            className="flex-1"
          />
          <Button
            variant="primary"
            onClick={handleSend}
            disabled={!message.trim() || isStreaming}
            className="!h-9 !w-9 !p-0"
          >
            {isStreaming ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </Button>
        </div>
      </div>
    </div>
  );
}

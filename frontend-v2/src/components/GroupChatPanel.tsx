import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { multiChatApi } from '@/lib/api/multi-chat';
import { CloseCircle as X, Send, MagicStar as Sparkles, DocumentText as FileText, Lamp as Lightbulb, Global } from 'iconsax-reactjs';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { MarkdownMessage } from '@/components/MarkdownMessage';
import { ExpandedInput } from '@/components/ExpandedInput';
import { cn } from '@/lib/utils';

interface GroupChatPanelProps {
  groupId: number;
  groupName: string;
  onClose: () => void;
}

const WORDS_PER_SECOND = 12;
const WORD_REVEAL_DELAY_MS = 1000 / WORDS_PER_SECOND;

const GROUP_PROMPTS = [
  {
    label: 'Analyze',
    icon: FileText,
    prompts: [
      { icon: FileText, text: 'Summarize All', prompt: 'Provide a concise summary of the key findings and contributions across all papers in this group.' },
      { icon: FileText, text: 'Compare Methods', prompt: 'Compare and contrast the methodologies used across these papers. What are the key differences and similarities in their approaches?' },
    ],
  },
  {
    label: 'Synthesize',
    icon: Lightbulb,
    prompts: [
      { icon: Global, text: 'Research Landscape', prompt: 'Describe how these papers fit into the broader research landscape. What are the connections and conflicts between their findings?' },
      { icon: Lightbulb, text: 'Identify Gaps', prompt: 'Based on these papers, what are the most important open questions or underexplored areas that future research should address?' },
    ],
  },
];

export function GroupChatPanel({ groupId, groupName, onClose }: GroupChatPanelProps) {
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [streamingContent, setStreamingContent] = useState('');
  const [displayContent, setDisplayContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [pendingUserMessage, setPendingUserMessage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data: latestSession } = useQuery({
    queryKey: ['multi-chat', 'latest', 'group', groupId],
    queryFn: () => multiChatApi.getGroupHistory(groupId),
    enabled: currentSessionId === null,
  });

  useEffect(() => {
    if (currentSessionId === null && latestSession) {
      setCurrentSessionId(latestSession.id);
    }
  }, [latestSession, currentSessionId]);

  const { data: currentSession, isLoading } = useQuery({
    queryKey: ['multi-chat', 'session', currentSessionId],
    queryFn: () => multiChatApi.getSession(currentSessionId!),
    enabled: currentSessionId !== null,
  });

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
    if (displayWords.length >= words.length) { setDisplayContent(streamingContent); return; }
    const timer = setTimeout(() => {
      setDisplayContent(words.slice(0, displayWords.length + 1).join(''));
    }, WORD_REVEAL_DELAY_MS);
    return () => clearTimeout(timer);
  }, [streamingContent, displayContent, isStreaming]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentSession?.messages, displayContent, pendingUserMessage]);

  const handleSend = async () => {
    if (!message.trim() || isStreaming) return;
    const userMessage = message.trim();
    setMessage('');
    setPendingUserMessage(userMessage);
    setIsStreaming(true);
    setStreamingContent('');
    setDisplayContent('');
    try {
      let sessionId = currentSessionId;
      if (!sessionId) {
        const session = await createSessionMutation.mutateAsync();
        sessionId = session.id;
      }
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
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--panel-border)] bg-[var(--panel-surface)]">
        <div>
          <h2 className="text-body font-medium">{groupName}</h2>
          <p className="text-caption text-[var(--muted-foreground)]">
            {currentSession?.papers.length || 0} papers
          </p>
        </div>
        <Button variant="ghost" className="!h-8 !w-8 !p-0" onClick={onClose}>
          <X size={16} />
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-0.5">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Skeleton className="w-12 h-12 rounded-full" />
          </div>
        ) : messages.length === 0 && !isStreaming && !pendingUserMessage ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-[var(--muted-foreground)] opacity-50">
            <Sparkles size={32} className="mb-3" />
            <p className="text-code">Ask about papers in this group</p>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  'group relative w-full px-4 py-2.5 text-code bg-transparent transition-colors border border-transparent',
                  msg.role === 'user'
                    ? 'hover:bg-[rgba(60,145,230,0.05)] hover:border-[rgba(60,145,230,0.25)]'
                    : 'hover:bg-[rgba(76,255,169,0.06)] hover:border-[rgba(76,255,169,0.3)]'
                )}
              >
                <span className={cn(
                  'absolute top-0 left-0 h-[2px] w-10',
                  msg.role === 'user' ? 'bg-[rgba(60,145,230,0.5)]' : 'bg-[rgba(76,255,169,0.5)]'
                )} />
                {msg.role === 'user' ? (
                  <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                ) : (
                  <MarkdownMessage content={msg.content} />
                )}
              </div>
            ))}

            {pendingUserMessage && (
              <div className="relative w-full px-4 py-2.5 rounded-b-interactive text-code bg-transparent border border-transparent">
                <span className="absolute top-0 left-0 h-[2px] w-10 bg-[rgba(60,145,230,0.5)]" />
                <p className="leading-relaxed whitespace-pre-wrap">{pendingUserMessage}</p>
              </div>
            )}

            {isStreaming && (
              <div className="relative w-full px-4 py-2.5 rounded-b-interactive text-code bg-transparent border border-transparent">
                <span className="absolute top-0 left-0 h-[2px] w-10 bg-[rgba(76,255,169,0.5)]" />
                {displayContent ? (
                  <MarkdownMessage content={displayContent} />
                ) : (
                  <div className="space-y-2.5 w-72">
                    <div className="flex flex-wrap gap-1.5">
                      {[12, 16, 8, 20, 14, 10, 24].map((w, i) => (
                        <div key={i} className={`h-3 bg-[var(--muted)] rounded animate-pulse w-${w}`} />
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {[20, 8, 16, 12, 10].map((w, i) => (
                        <div key={i} className={`h-3 bg-[var(--muted)] rounded animate-pulse w-${w}`} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-[var(--panel-border)] p-3 shrink-0 bg-[var(--panel-surface)]">
        <ExpandedInput
          value={message}
          onChange={setMessage}
          onSubmit={handleSend}
          placeholder="Ask about these papers... (Enter to send)"
          submitLabel="Send"
          submitIcon={<Send size={14} />}
          disabled={isStreaming}
          promptsCollapsible
          promptGroups={GROUP_PROMPTS}
        />
      </div>
    </div>
  );
}

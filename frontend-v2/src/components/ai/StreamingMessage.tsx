import { useState, useCallback } from 'react';
import { MarkdownMessage } from '@/components/MarkdownMessage';
import { ToolCallIndicator } from '@/components/ai/ToolCallIndicator';
import { ErrorBanner } from '@/components/ai/ErrorBanner';
import { AgentThoughtPanel } from '@/components/ai/AgentThoughtPanel';
import { cn } from '@/lib/utils';
import type { ChatStreamState, ToolCallEvent, ToolResultEvent } from '@/hooks/use-chat-stream';

export interface StreamingMessageProps {
  state: ChatStreamState;
  isStreaming: boolean;
  onRetry?: () => void;
  onDismiss?: () => void;
  onSettings?: () => void;
  className?: string;
}

function getToolStatus(
  toolName: string,
  toolCalls: ToolCallEvent[],
  toolResults: ToolResultEvent[],
): 'pending' | 'running' | 'complete' | 'error' {
  const callCount = toolCalls.filter((t) => t.tool === toolName).length;
  const resultCount = toolResults.filter((t) => t.tool === toolName).length;

  if (resultCount >= callCount) {
    return resultCount > 0 ? 'complete' : 'pending';
  }
  return 'running';
}

export function StreamingMessage({
  state,
  isStreaming,
  onRetry,
  onDismiss,
  onSettings,
  className,
}: StreamingMessageProps) {
  const [expandedTool, setExpandedTool] = useState<string | null>(null);

  const toolCallNames = state.toolCalls
    .map((t) => t.tool)
    .filter((v, i, a) => a.indexOf(v) === i);

  const handleToggleTool = useCallback((tool: string) => {
    setExpandedTool((prev) => (prev === tool ? null : tool));
  }, []);

  // If done or idle with no content, don't render
  if (state.status === 'idle' && !state.content && state.thoughts.length === 0 && state.toolCalls.length === 0) {
    return null;
  }

  return (
    <div className={cn('relative w-full px-4 py-2.5 rounded-b-interactive bg-transparent border border-transparent', className)}>
      <span className="absolute top-0 left-0 h-[0.125rem] w-10 bg-[rgba(76,255,169,0.5)]" />

      {/* Agent reasoning (thoughts) */}
      <AgentThoughtPanel thoughts={state.thoughts} />

      {/* Tool calls */}
      {toolCallNames.length > 0 && (
        <div className="my-1 space-y-0.5">
          {toolCallNames.map((toolName) => {
            const resultEvent = [...state.toolResults].reverse().find((t: ToolResultEvent) => t.tool === toolName);
            const status = getToolStatus(toolName, state.toolCalls, state.toolResults);
            return (
              <ToolCallIndicator
                key={toolName}
                tool={toolName}
                status={status}
                result={resultEvent?.result}
                expanded={expandedTool === toolName}
                onToggle={() => handleToggleTool(toolName)}
              />
            );
          })}
        </div>
      )}

      {/* Text content */}
      {(state.displayedContent || isStreaming) && (
        <div className="mt-1">
          {state.displayedContent ? (
            <MarkdownMessage content={state.displayedContent} />
          ) : (
            <div className="space-y-2.5 w-72">
              <div className="flex flex-wrap gap-1.5">
                {[{ w: 12 }, { w: 16 }, { w: 8 }, { w: 20 }, { w: 14 }, { w: 10 }, { w: 24 }].map((s, i) => (
                  <div key={i} className="h-3 bg-(--muted) rounded animate-pulse" style={{ width: `${s.w * 4}px` }} />
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[{ w: 20 }, { w: 8 }, { w: 16 }, { w: 12 }, { w: 10 }].map((s, i) => (
                  <div key={i} className="h-3 bg-(--muted) rounded animate-pulse" style={{ width: `${s.w * 4}px` }} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Cursor blink during streaming */}
      {isStreaming && state.displayedContent && (
        <span className="inline-block w-[0.125rem] h-4 bg-(--foreground) ml-0.5 animate-pulse" />
      )}

      {/* Error banner */}
      {state.error && (
        <div className="mt-2">
          <ErrorBanner
            message={state.error.message}
            code={state.error.code}
            recoverable={state.error.recoverable}
            onRetry={onRetry}
            onDismiss={onDismiss}
            onSettings={onSettings}
          />
        </div>
      )}
    </div>
  );
}

export default StreamingMessage;

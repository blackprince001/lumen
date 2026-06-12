import { useState } from 'react';
import type { ThoughtEvent } from '@/hooks/use-chat-stream';

export interface AgentThoughtPanelProps {
  thoughts: ThoughtEvent[];
  maxVisible?: number;
}

export function AgentThoughtPanel({
  thoughts,
  maxVisible = 5,
}: AgentThoughtPanelProps) {
  const [expanded, setExpanded] = useState(false);

  if (thoughts.length === 0) return null;

  const visible = expanded ? thoughts : thoughts.slice(-maxVisible);
  const hiddenCount = thoughts.length - visible.length;

  return (
    <div className="text-caption text-(--muted-foreground) border-l-2 border-(--border) pl-3 my-1 space-y-1">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-[0.6875rem] font-medium hover:text-(--foreground) transition-colors"
      >
        <span className="inline-block w-2 h-2 rounded-full bg-(--muted-foreground) animate-pulse" />
        {expanded ? 'Hide reasoning' : `Agent thoughts (${thoughts.length})`}
        <span className="ml-1">{expanded ? '▾' : '▸'}</span>
      </button>

      {expanded && (
        <div className="space-y-1.5 mt-1">
          {visible.map((thought, i) => (
            <div key={i} className="text-[0.6875rem] leading-relaxed opacity-80">
              {thought.content}
            </div>
          ))}
          {hiddenCount > 0 && (
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="text-[0.6875rem] text-(--muted-foreground) hover:text-(--foreground)"
            >
              Show fewer ({hiddenCount} hidden)
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default AgentThoughtPanel;

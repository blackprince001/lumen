import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { MapNode } from '@/lib/api/citationMap';
import { cn } from '@/lib/utils';

export interface ReferenceNodeData {
  node: MapNode;
  r: number;
  [key: string]: unknown;
}

function ReferenceNodeComponent({ data, selected }: NodeProps) {
  const { node, r } = data as ReferenceNodeData;
  const size = r * 2;

  const label = node.authors
    ? `${node.authors}${node.year ? `, ${node.year}` : ''}`
    : node.title.length > 28
      ? `${node.title.slice(0, 28)}…`
      : node.title;

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
      title={node.title}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="opacity-0! pointer-events-none!"
        style={{ left: r, top: r }}
      />
      <div
        className={cn(
          'rounded-full transition-all',
          node.is_focal
            ? 'bg-(--foreground)'
            : node.shared
              ? 'bg-(--coral-red)/15'
              : 'bg-(--card)',
          selected && 'ring-2 ring-(--foreground) ring-offset-1'
        )}
        style={{
          width: size,
          height: size,
          border: node.is_focal
            ? 'none'
            : `2px solid ${node.shared ? 'var(--coral-red)' : 'var(--sky-blue)'}`,
        }}
      />
      <span
        className={cn(
          'absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-caption leading-none pointer-events-none',
          node.is_focal ? 'font-semibold text-(--foreground)' : 'text-(--muted-foreground)'
        )}
        style={{ top: size + 4 }}
      >
        {label}
      </span>
      <Handle
        type="source"
        position={Position.Bottom}
        className="opacity-0! pointer-events-none!"
        style={{ left: r, top: r }}
      />
    </div>
  );
}

export const ReferenceNode = memo(ReferenceNodeComponent);

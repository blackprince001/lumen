import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  MarkerType,
  type Node,
  type Edge,
  type NodeChange,
  type OnNodeDrag,
} from '@xyflow/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Hierarchy3 as Network } from 'iconsax-reactjs';
import { citationCanvasApi, type CanvasResponse } from '@/lib/api/citationCanvas';
import { PaperNode, type PaperNodeData } from './canvas/PaperNode';
import { toastError } from '@/lib/utils/toast';

import '@xyflow/react/dist/style.css';

const NODE_TYPES = { paper: PaperNode };

const DRAG_SOURCE_MIME = 'application/x-paper-id';

interface CitationCanvasProps {
  /** When true, the picker sidebar provides a paper id via drag-and-drop. */
  onDropPaper?: (paperId: number, position: { x: number; y: number }) => void;
}

function CitationCanvasInner({ onDropPaper: _onDropPaper }: CitationCanvasProps) {
  const queryClient = useQueryClient();
  const { screenToFlowPosition } = useReactFlow();
  const wrapperRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery<CanvasResponse>({
    queryKey: ['citation-canvas'],
    queryFn: () => citationCanvasApi.get(),
  });

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<PaperNodeData>>([]);
  const [edges, setEdges] = useEdgesState<Edge>([]);

  const removeMutation = useMutation({
    mutationFn: (paperId: number) => citationCanvasApi.removeItem(paperId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['citation-canvas'] }),
    onError: () => toastError('Failed to remove from canvas'),
  });

  const addMutation = useMutation({
    mutationFn: ({ paperId, x, y }: { paperId: number; x: number; y: number }) =>
      citationCanvasApi.addItem(paperId, x, y),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['citation-canvas'] }),
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to add paper';
      toastError(msg);
    },
  });

  const positionMutation = useMutation({
    mutationFn: ({ paperId, x, y }: { paperId: number; x: number; y: number }) =>
      citationCanvasApi.updatePosition(paperId, x, y),
  });

  const handleRemoveRef = useRef(removeMutation.mutate);
  handleRemoveRef.current = removeMutation.mutate;

  const handleRemove = useCallback((paperId: number) => {
    handleRemoveRef.current(paperId);
  }, []);

  // Sync server state → local state
  useEffect(() => {
    if (!data) return;

    const newNodes: Node<PaperNodeData>[] = data.items.map((item) => ({
      id: String(item.paper_id),
      type: 'paper',
      position: { x: item.x, y: item.y },
      data: { paper: item.paper, onRemove: handleRemove },
    }));

    const newEdges: Edge[] = data.edges.map((e, i) => ({
      id: `e-${e.source}-${e.target}-${i}`,
      source: String(e.source),
      target: String(e.target),
      type: 'default',
      markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14, color: 'var(--border)' },
      style: { stroke: 'var(--border)', strokeWidth: 1.5 },
    }));

    setNodes(newNodes);
    setEdges(newEdges);
  }, [data, handleRemove, setNodes, setEdges]);

  const handleNodesChange = useCallback((changes: NodeChange<Node<PaperNodeData>>[]) => {
    onNodesChange(changes);
  }, [onNodesChange]);

  const handleNodeDragStop: OnNodeDrag<Node<PaperNodeData>> = useCallback(
    (_event, node) => {
      const paperId = Number(node.id);
      if (!Number.isFinite(paperId)) return;
      positionMutation.mutate({ paperId, x: node.position.x, y: node.position.y });
    },
    [positionMutation]
  );

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    const raw = event.dataTransfer.getData(DRAG_SOURCE_MIME);
    const paperId = Number(raw);
    if (!Number.isFinite(paperId) || paperId <= 0) return;

    const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    addMutation.mutate({ paperId, x: position.x, y: position.y });
  }, [addMutation, screenToFlowPosition]);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }, []);

  const isEmpty = useMemo(() => !isLoading && nodes.length === 0, [isLoading, nodes.length]);

  return (
    <div ref={wrapperRef} className="relative w-full h-full bg-[var(--background)]" onDrop={handleDrop} onDragOver={handleDragOver}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onNodeDragStop={handleNodeDragStop}
        nodeTypes={NODE_TYPES}
        fitView={nodes.length > 0}
        fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
        minZoom={0.25}
        maxZoom={1.5}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="var(--border)" gap={24} size={1} />
        <Controls position="bottom-right" showInteractive={false} />
        <MiniMap
          position="bottom-left"
          pannable
          zoomable
          maskColor="rgba(0,0,0,0.04)"
          nodeColor={() => 'var(--muted)'}
          nodeStrokeColor={() => 'var(--border)'}
          style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}
        />
      </ReactFlow>

      {isEmpty && (
        <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center gap-2">
          <Network size={36} className="text-[var(--border)]" />
          <p className="text-code text-[var(--foreground)]">Drag papers from the sidebar to start</p>
          <p className="text-caption text-[var(--muted-foreground)]">Citation edges will appear automatically between papers on the canvas</p>
        </div>
      )}
    </div>
  );
}

export { DRAG_SOURCE_MIME };

export function CitationCanvas(props: CitationCanvasProps) {
  return (
    <ReactFlowProvider>
      <CitationCanvasInner {...props} />
    </ReactFlowProvider>
  );
}

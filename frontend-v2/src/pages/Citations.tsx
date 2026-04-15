import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { SearchNormal as Search, Hierarchy as GitBranch, Refresh as Loader2, Refresh as RefreshCw, Hierarchy3 as Network } from 'iconsax-reactjs';
import { papersApi } from '@/lib/api/papers';
import { PaperCitationsList } from '@/components/PaperCitationsList';
import { Button } from '@/components/ui/Button';
import { toastSuccess, toastError } from '@/lib/utils/toast';
import { cn } from '@/lib/utils';
import ForceGraph2D from 'react-force-graph-2d';

type ViewTab = 'list' | 'graph';

export default function Citations() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPaperId, setSelectedPaperId] = useState<number | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeTab, setActiveTab] = useState<ViewTab>('list');

  const { data: papersData, isLoading: papersLoading } = useQuery({
    queryKey: ['papers', 1, 100, searchQuery],
    queryFn: () => papersApi.list(1, 100, searchQuery || undefined),
  });

  const filteredPapers = useMemo(() => {
    if (!papersData?.papers) return [];
    if (!searchQuery.trim()) return papersData.papers.slice(0, 20);
    const q = searchQuery.toLowerCase();
    return papersData.papers.filter(
      (p) => p.title.toLowerCase().includes(q) || (p.metadata_json?.author as string | undefined)?.toLowerCase().includes(q)
    ).slice(0, 20);
  }, [papersData, searchQuery]);

  const { data: citationsData, isLoading: citationsLoading, error: citationsError } = useQuery({
    queryKey: ['citations-list', selectedPaperId],
    queryFn: () => papersApi.getCitationsList(selectedPaperId!),
    enabled: !!selectedPaperId,
  });

  const { data: graphData, isLoading: graphLoading } = useQuery({
    queryKey: ['citation-graph', selectedPaperId],
    queryFn: () => papersApi.getCitationGraph(selectedPaperId!),
    enabled: !!selectedPaperId && activeTab === 'graph',
  });

  const extractMutation = useMutation({
    mutationFn: () => papersApi.extractCitations(selectedPaperId!),
    onSuccess: (data) => toastSuccess(`Extracted ${data.citations_extracted} citations`),
    onError: () => toastError('Failed to extract citations'),
  });

  const selectedPaper = useMemo(
    () => papersData?.papers.find((p) => p.id === selectedPaperId) ?? null,
    [selectedPaperId, papersData]
  );

  // Transform graph data for react-force-graph-2d
  const forceGraphData = useMemo(() => {
    if (!graphData) return { nodes: [], links: [] };
    return {
      nodes: graphData.nodes.map((n) => ({ id: n.id, label: n.title, type: n.type })),
      links: graphData.edges.map((e) => ({ source: e.source, target: e.target })),
    };
  }, [graphData]);

  const handleNodeClick = useCallback((node: any) => {
    if (typeof node.id === 'number') navigate(`/papers/${node.id}`);
  }, [navigate]);

  return (
    <div className="max-w-content mx-auto px-6 py-8">
      <div className="mb-8">
        <h1>Paper Citations</h1>
        <p className="text-btn text-[var(--muted-foreground)] mt-1">
          Explore citation relationships between papers in your library
        </p>
      </div>

      {/* Paper Search */}
      <div className="relative mb-8">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setShowDropdown(true); }}
            onFocus={() => setShowDropdown(true)}
            placeholder="Search papers to view citations..."
            className="w-full max-w-2xl pl-9 pr-4 h-10 bg-[var(--card)] border border-[var(--border)] rounded-xl text-code text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:border-[var(--foreground)] transition-colors"
          />
          {papersLoading && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-[var(--muted-foreground)]" />}
        </div>

        {showDropdown && searchQuery && filteredPapers.length > 0 && (
          <div className="absolute top-full left-0 max-w-2xl w-full mt-1 bg-[var(--white)] border border-[var(--border)] rounded-xl shadow-lg z-50 max-h-80 overflow-y-auto">
            {filteredPapers.map((paper) => (
              <button
                key={paper.id}
                onClick={() => { setSelectedPaperId(paper.id); setSearchQuery(''); setShowDropdown(false); }}
                className="w-full text-left px-4 py-3 hover:bg-[var(--muted)] border-b border-[var(--border)] last:border-b-0 transition-colors"
              >
                <p className="text-code font-medium text-[var(--foreground)] line-clamp-1">{paper.title}</p>
                {!!paper.metadata_json?.author && (
                  <p className="text-caption text-[var(--muted-foreground)] mt-0.5 line-clamp-1">{paper.metadata_json.author as string}</p>
                )}
              </button>
            ))}
          </div>
        )}

        {showDropdown && searchQuery && !papersLoading && filteredPapers.length === 0 && (
          <div className="absolute top-full left-0 max-w-2xl w-full mt-1 bg-[var(--white)] border border-[var(--border)] rounded-xl shadow-lg z-50 px-4 py-3 text-code text-[var(--muted-foreground)]">
            No papers found matching "{searchQuery}"
          </div>
        )}
      </div>

      {selectedPaper ? (
        <>
          {/* Selected paper info */}
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 mb-6 flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h4 className="text-body font-semibold text-[var(--foreground)] line-clamp-1">{selectedPaper.title}</h4>
              {!!selectedPaper.metadata_json?.author && (
                <p className="text-caption text-[var(--muted-foreground)] mt-0.5">{selectedPaper.metadata_json.author as string}</p>
              )}
              {citationsData && (
                <p className="text-caption text-[var(--muted-foreground)] mt-1">
                  {citationsData.citations.length} citation{citationsData.citations.length !== 1 ? 's' : ''} found
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="secondary"
                className="!h-8 !text-caption"
                icon={extractMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                disabled={extractMutation.isPending}
                onClick={() => extractMutation.mutate()}
              >
                Extract Citations
              </Button>
              <button
                onClick={() => navigate(`/papers/${selectedPaper.id}`)}
                className="px-3 py-1.5 text-caption font-medium bg-[var(--muted)] text-[var(--foreground)] border border-[var(--border)] rounded-lg hover:bg-[var(--border)] transition-colors"
              >
                View Paper
              </button>
            </div>
          </div>

          {/* List / Graph tabs */}
          <div className="flex items-center gap-1 mb-6 border-b border-[var(--border)]">
            {([['list', 'List', GitBranch], ['graph', 'Graph', Network]] as const).map(([id, label, Icon]) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={cn(
                  'flex items-center gap-1.5 h-9 px-3 text-code font-semibold border-b-2 -mb-px transition-all',
                  activeTab === id
                    ? 'border-[var(--foreground)] text-[var(--foreground)]'
                    : 'border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                )}
              >
                <Icon size={13} />{label}
              </button>
            ))}
          </div>

          {activeTab === 'list' ? (
            <PaperCitationsList
              citations={citationsData?.citations || []}
              isLoading={citationsLoading}
              error={citationsError}
            />
          ) : (
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden" style={{ height: 500 }}>
              {graphLoading ? (
                <div className="h-full flex items-center justify-center">
                  <Loader2 size={24} className="animate-spin text-[var(--muted-foreground)]" />
                </div>
              ) : forceGraphData.nodes.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center gap-2">
                  <GitBranch size={36} className="text-[var(--border)]" />
                  <p className="text-code text-[var(--muted-foreground)]">No citation graph data available</p>
                  <p className="text-caption text-[var(--muted-foreground)]">Try extracting citations first</p>
                </div>
              ) : (
                <ForceGraph2D
                  graphData={forceGraphData}
                  nodeLabel="label"
                  nodeColor={(n: any) => n.type === 'paper' ? '#232927' : '#A1AAA6'}
                  linkColor={() => '#E2E4E3'}
                  onNodeClick={handleNodeClick}
                  nodeRelSize={5}
                  width={undefined}
                  height={500}
                />
              )}
            </div>
          )}
        </>
      ) : (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-12 text-center">
          <GitBranch size={40} className="text-[var(--border)] mx-auto mb-3" />
          <p className="text-body font-medium text-[var(--foreground)] mb-1">No paper selected</p>
          <p className="text-code text-[var(--muted-foreground)]">Search for a paper above to view its citations</p>
        </div>
      )}
    </div>
  );
}

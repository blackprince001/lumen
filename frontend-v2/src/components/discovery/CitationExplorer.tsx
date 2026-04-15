import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CloseCircle as X, ArrowRight, Refresh as Loader2, ExportSquare as ExternalLink } from 'iconsax-reactjs';
import { discoveryApi, type DiscoveredPaperPreview } from '@/lib/api/discovery';

interface CitationExplorerProps {
  paper: DiscoveredPaperPreview;
  isOpen: boolean;
  onClose: () => void;
  onSelectPaper: (paper: DiscoveredPaperPreview) => void;
}

function PaperItem({ paper, onClick }: { paper: DiscoveredPaperPreview; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full p-3 bg-[var(--card)] border border-[var(--border)] rounded-xl hover:border-[var(--foreground)] transition-colors text-left group"
    >
      <p className="text-code font-semibold text-[var(--foreground)] leading-snug line-clamp-2">{paper.title}</p>
      <div className="flex items-center justify-between mt-1.5">
        <p className="text-caption text-[var(--muted-foreground)] line-clamp-1">
          {paper.authors?.slice(0, 2).join(', ')}{paper.authors && paper.authors.length > 2 ? ' et al.' : ''}
          {paper.year ? ` · ${paper.year}` : ''}
          {paper.citation_count !== undefined ? ` · ${paper.citation_count} citations` : ''}
        </p>
        <div className="flex items-center gap-1 shrink-0 ml-2">
          {paper.url && (
            <a
              href={paper.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="p-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)] opacity-0 group-hover:opacity-100 transition-all"
            >
              <ExternalLink size={12} />
            </a>
          )}
          <ArrowRight size={12} className="text-[var(--muted-foreground)] group-hover:translate-x-0.5 transition-transform" />
        </div>
      </div>
    </button>
  );
}

export function CitationExplorer({ paper, isOpen, onClose, onSelectPaper }: CitationExplorerProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['citation-explorer', paper.source, paper.external_id],
    queryFn: () => discoveryApi.exploreCitations({ source: paper.source, external_id: paper.external_id, direction: 'both' }),
    enabled: isOpen,
  });

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-4xl max-h-[90vh] bg-[var(--white)] border border-[var(--border)] rounded-2xl shadow-modal flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between bg-[var(--card)]">
          <div className="flex-1 min-w-0 pr-8">
            <h3 className="text-btn font-bold text-[var(--foreground)] truncate">{paper.title}</h3>
            <p className="text-caption text-[var(--muted-foreground)] mt-0.5">
              {paper.authors?.slice(0, 2).join(', ')}{paper.authors && paper.authors.length > 2 ? ' et al.' : ''}
              {paper.year ? ` · ${paper.year}` : ''}
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] rounded-xl transition-colors shrink-0">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-[var(--muted-foreground)]" />
          </div>
        ) : error ? (
          <div className="flex-1 flex items-center justify-center py-16">
            <p className="text-code text-[var(--muted-foreground)]">Failed to load citation data.</p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
            {/* References */}
            <div className="flex-1 flex flex-col border-r border-[var(--border)]">
              <div className="px-5 py-2.5 bg-[var(--muted)] border-b border-[var(--border)]">
                <span className="text-caption font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
                  References ({data?.references_count ?? data?.references.length ?? 0})
                </span>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {data?.references.length === 0 && (
                  <p className="text-caption text-[var(--muted-foreground)] text-center py-8">No references found</p>
                )}
                {data?.references.map((ref, i) => (
                  <PaperItem key={i} paper={ref} onClick={() => onSelectPaper(ref)} />
                ))}
              </div>
            </div>

            {/* Citations */}
            <div className="flex-1 flex flex-col">
              <div className="px-5 py-2.5 bg-[var(--muted)] border-b border-[var(--border)]">
                <span className="text-caption font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
                  Citations ({data?.citations_count ?? data?.citations.length ?? 0})
                </span>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {data?.citations.length === 0 && (
                  <p className="text-caption text-[var(--muted-foreground)] text-center py-8">No citations found</p>
                )}
                {data?.citations.map((cit, i) => (
                  <PaperItem key={i} paper={cit} onClick={() => onSelectPaper(cit)} />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

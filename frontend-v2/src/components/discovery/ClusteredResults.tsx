import { useState } from 'react';
import { ArrowDown2 as ChevronDown, ArrowUp2 as ChevronUp, Tag, MagicStar as Sparkles } from 'iconsax-reactjs';
import type { ClusteringResult, DiscoveredPaperPreview, PaperRelevanceExplanation } from '@/lib/api/discovery';
import { DiscoveredPaperCard } from './DiscoveredPaperCard';

interface ClusteredResultsProps {
  clustering: ClusteringResult;
  papers: DiscoveredPaperPreview[];
  relevanceExplanations?: PaperRelevanceExplanation[];
}

interface ClusterSectionProps {
  name: string;
  description: string;
  keywords: string[];
  papers: DiscoveredPaperPreview[];
  relevanceMap: Map<number, PaperRelevanceExplanation>;
  defaultExpanded?: boolean;
}

function ClusterSection({ name, description, keywords, papers, relevanceMap, defaultExpanded = true }: ClusterSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden mb-4">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-[var(--muted)] transition-colors text-left"
      >
        <div className="flex items-start gap-3">
          <Tag className="w-4 h-4 text-[var(--muted-foreground)] shrink-0 mt-0.5" />
          <div>
            <h3 className="text-body font-semibold text-[var(--foreground)]">{name}</h3>
            {description && (
              <p className="text-caption text-[var(--muted-foreground)] mt-0.5">{description}</p>
            )}
            {keywords.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {keywords.slice(0, 5).map((kw, i) => (
                  <span key={i} className="px-2 py-0.5 bg-[var(--muted)] text-[var(--muted-foreground)] text-caption rounded border border-[var(--border)]">
                    {kw}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-4">
          <span className="text-caption text-[var(--muted-foreground)]">{papers.length} papers</span>
          {isExpanded
            ? <ChevronUp className="w-4 h-4 text-[var(--muted-foreground)]" />
            : <ChevronDown className="w-4 h-4 text-[var(--muted-foreground)]" />}
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-[var(--border)] p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          {papers.map((paper, localIdx) => {
            const relevance = relevanceMap.get(localIdx);
            return (
              <div key={`${paper.source}-${paper.external_id}`} className="flex flex-col gap-2">
                <DiscoveredPaperCard paper={paper} />
                {relevance && (
                  <div className="px-3 py-2 bg-[var(--muted)] rounded-lg border border-[var(--border)] flex items-start gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-[var(--muted-foreground)] shrink-0 mt-0.5" />
                    <div className="text-caption text-[var(--muted-foreground)] space-y-0.5">
                      <p><span className="font-medium text-[var(--foreground)]">Why relevant: </span>{relevance.relevance}</p>
                      {relevance.key_contribution && (
                        <p><span className="font-medium text-[var(--foreground)]">Key contribution: </span>{relevance.key_contribution}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function ClusteredResults({ clustering, papers, relevanceExplanations = [] }: ClusteredResultsProps) {
  const globalRelevanceMap = new Map(relevanceExplanations.map((e) => [e.paper_index, e]));
  const unclusteredPapers = clustering.unclustered_indices.map((i) => papers[i]).filter(Boolean);

  return (
    <div>
      {clustering.clusters.map((cluster, clusterIdx) => {
        const clusterPapers = cluster.paper_indices.map((i) => papers[i]).filter(Boolean);
        if (clusterPapers.length === 0) return null;

        const localRelevanceMap = new Map<number, PaperRelevanceExplanation>();
        cluster.paper_indices.forEach((globalIdx, localIdx) => {
          const rel = globalRelevanceMap.get(globalIdx);
          if (rel) localRelevanceMap.set(localIdx, rel);
        });

        return (
          <ClusterSection
            key={clusterIdx}
            name={cluster.name}
            description={cluster.description}
            keywords={cluster.keywords}
            papers={clusterPapers}
            relevanceMap={localRelevanceMap}
            defaultExpanded={clusterIdx === 0}
          />
        );
      })}

      {unclusteredPapers.length > 0 && (
        <ClusterSection
          name="Other Results"
          description="Papers that don't fit neatly into the main topic clusters"
          keywords={[]}
          papers={unclusteredPapers}
          relevanceMap={new Map()}
          defaultExpanded={false}
        />
      )}
    </div>
  );
}

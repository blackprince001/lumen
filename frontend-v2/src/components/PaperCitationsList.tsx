import { Link } from 'react-router-dom';
import { ExportSquare as ExternalLink, Book1 as BookOpen } from 'iconsax-reactjs';
import { cn } from '@/lib/utils';
import type { Citation } from '@/lib/api/papers';

interface PaperCitationsListProps {
  citations: Citation[];
  isLoading: boolean;
  error: any;
  className?: string;
}

export function PaperCitationsList({ citations, isLoading, error, className }: PaperCitationsListProps) {
  if (isLoading) {
    return (
      <div className="p-4 flex items-center justify-center text-code text-[var(--muted-foreground)]">
        <div className="animate-pulse">Loading citations...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-code text-[var(--destructive)]">
        Unable to load citations.
      </div>
    );
  }

  if (!citations || citations.length === 0) {
    return (
      <div className="p-8 text-center text-code text-[var(--muted-foreground)] opacity-60">
        No citations found for this paper.
      </div>
    );
  }

  const internalCitations = citations.filter(c => c.cited_paper_id !== null && c.cited_paper);
  const externalCitations = citations.filter(c => c.cited_paper_id === null);

  const renderCitation = (citation: Citation) => {
    const isInternal = !!citation.cited_paper_id;
    const title = isInternal ? citation.cited_paper?.title : citation.external_paper_title;
    const authors = isInternal ? citation.cited_paper?.authors : null;
    const doi = isInternal ? citation.cited_paper?.doi : citation.external_paper_doi;
    const url = isInternal ? `/papers/${citation.cited_paper?.id}` : (doi ? `https://doi.org/${doi}` : null);

    return (
      <div key={citation.id} className="group p-4 rounded-xl border border-[var(--border)] bg-[var(--card)] hover:border-[var(--muted-foreground)]/30 transition-all">
        <div className="flex items-start justify-between gap-2">
          {isInternal && url ? (
            <Link 
              to={url}
              className="text-code font-medium text-[var(--foreground)] hover:text-[var(--sky-blue)] transition-colors line-clamp-2 flex-1"
            >
              {title || 'Untitled Paper'}
            </Link>
          ) : (
            <span className="text-code font-medium text-[var(--foreground)] line-clamp-2 flex-1">
              {title || 'Untitled Paper'}
            </span>
          )}
          
          {url && (
            isInternal ? (
              <Link to={url} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors p-1">
                <BookOpen size={14} />
              </Link>
            ) : (
              <a href={url} target="_blank" rel="noopener noreferrer" className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors p-1">
                <ExternalLink size={14} />
              </a>
            )
          )}
        </div>

        {authors && (
          <p className="mt-1 text-caption text-[var(--muted-foreground)] truncate">
            {authors}
          </p>
        )}

        {citation.citation_context && (
          <p className="mt-2 text-caption text-[var(--muted-foreground)] opacity-80 line-clamp-2 bg-[var(--muted)]/20 p-1.5 rounded">
            "{citation.citation_context}"
          </p>
        )}

        {doi && (
          <div className="mt-1.5 text-micro text-[var(--muted-foreground)] opacity-50 tabular-nums">
            DOI: {doi}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={cn("space-y-6", className)}>
      {internalCitations.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-caption font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
              Library Papers
            </h4>
            <span className="text-micro bg-[var(--muted)] px-1.5 py-0.5 rounded-full tabular-nums">
              {internalCitations.length}
            </span>
          </div>
          <div className="space-y-3">
            {internalCitations.map(renderCitation)}
          </div>
        </section>
      )}

      {externalCitations.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-caption font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
              External References
            </h4>
            <span className="text-micro bg-[var(--muted)] px-1.5 py-0.5 rounded-full tabular-nums">
              {externalCitations.length}
            </span>
          </div>
          <div className="space-y-3">
            {externalCitations.map(renderCitation)}
          </div>
        </section>
      )}
    </div>
  );
}

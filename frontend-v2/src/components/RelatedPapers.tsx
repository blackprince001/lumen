import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ExportSquare as ExternalLink, Book1 as BookOpen, Book1 as Library, Global as Globe, ArrowUp2 as ArrowUpRight, ArrowDown2 as ArrowDownLeft } from 'iconsax-reactjs';
import { Link } from 'react-router-dom';
import { papersApi, type RelatedPaperExternal, type Paper } from '@/lib/api/papers';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';

interface RelatedPapersProps {
  paperId: number;
}

export function RelatedPapers({ paperId }: RelatedPapersProps) {
  const [activeTab, setActiveTab] = useState('citations');

  const { data: related, isLoading, error } = useQuery({
    queryKey: ['related-papers', paperId],
    queryFn: () => papersApi.getRelated(paperId),
    enabled: !!paperId,
  });

  if (isLoading) {
    return (
      <div className="p-8 flex flex-col items-center justify-center text-[var(--muted-foreground)] opacity-50 space-y-3">
        <div className="w-8 h-8 rounded-full border-2 border-current border-t-transparent animate-spin" />
        <p className="text-code">Finding connections...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center text-code text-[var(--destructive)] opacity-80">
        Could not load related papers.
      </div>
    );
  }

  const renderExternalPaper = (paper: RelatedPaperExternal, index: number) => (
    <div key={index} className="group p-4 rounded-xl border border-[var(--border)] bg-[var(--card)] hover:border-[var(--muted-foreground)]/30 transition-all">
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-code font-medium text-[var(--foreground)] line-clamp-2 flex-1">
          {paper.title || 'Untitled Paper'}
        </h4>
        {paper.url && (
          <a
            href={paper.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors p-1"
          >
            <ExternalLink size={14} />
          </a>
        )}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-[var(--muted-foreground)] opacity-70">
        {paper.authors && paper.authors.length > 0 && (
          <span className="truncate max-w-[11.25rem]">{paper.authors.join(', ')}</span>
        )}
        {paper.year && <span className="tabular-nums">({paper.year})</span>}
      </div>
    </div>
  );

  const renderLibraryPaper = (paper: Paper) => (
    <div key={paper.id} className="group p-4 rounded-xl border border-[var(--border)] bg-[var(--card)] hover:border-[var(--muted-foreground)]/30 transition-all">
      <div className="flex items-start justify-between gap-2">
        <Link
          to={`/papers/${paper.id}`}
          className="text-code font-medium text-[var(--foreground)] hover:text-[var(--sky-blue)] transition-colors line-clamp-2 flex-1"
        >
          {paper.title}
        </Link>
        <Link to={`/papers/${paper.id}`} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors p-1">
          <BookOpen size={14} />
        </Link>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-[var(--muted-foreground)] opacity-70">
        <span>Added {new Date(paper.created_at).getFullYear()}</span>
        {paper.doi && <span className="tabular-nums">DOI: {paper.doi}</span>}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full justify-start border-none px-0 gap-4 mb-4">
          <TabsTrigger value="citations" className="px-0 pb-2 border-b-2 rounded-none">
            Citations ({ (related?.cited_by?.length || 0) + (related?.cited_here?.length || 0) })
          </TabsTrigger>
          <TabsTrigger value="similar" className="px-0 pb-2 border-b-2 rounded-none">
            Similar ({ (related?.related_library?.length || 0) + (related?.related_internet?.length || 0) })
          </TabsTrigger>
        </TabsList>

        <TabsContent value="citations" className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <section>
            <div className="flex items-center gap-2 mb-3">
              <ArrowUpRight size={14} className="text-[var(--muted-foreground)]" />
              <h3 className="text-caption font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
                Cited by
              </h3>
            </div>
            <div className="space-y-3">
              {related?.cited_by && related.cited_by.length > 0 ? (
                related.cited_by.map((item, idx) => renderExternalPaper(item, idx))
              ) : (
                <p className="py-6 text-center text-caption text-[var(--muted-foreground)] opacity-50 italic">No incoming citations</p>
              )}
            </div>
          </section>

          <section>
            <div className="flex items-center gap-2 mb-3">
              <ArrowDownLeft size={14} className="text-[var(--muted-foreground)]" />
              <h3 className="text-caption font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
                References
              </h3>
            </div>
            <div className="space-y-3">
              {related?.cited_here && related.cited_here.length > 0 ? (
                related.cited_here.map((item, idx) => renderExternalPaper(item, idx))
              ) : (
                <p className="py-6 text-center text-caption text-[var(--muted-foreground)] opacity-50 italic">No outgoing references</p>
              )}
            </div>
          </section>
        </TabsContent>

        <TabsContent value="similar" className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Library size={14} className="text-[var(--muted-foreground)]" />
              <h3 className="text-caption font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
                In Your Library
              </h3>
            </div>
            <div className="space-y-3">
              {related?.related_library && related.related_library.length > 0 ? (
                related.related_library.map((item) => renderLibraryPaper(item))
              ) : (
                <p className="py-6 text-center text-caption text-[var(--muted-foreground)] opacity-50 italic">No similar papers in library</p>
              )}
            </div>
          </section>

          <section>
            <div className="flex items-center gap-2 mb-3">
              <Globe size={14} className="text-[var(--muted-foreground)]" />
              <h3 className="text-caption font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
                From the Web
              </h3>
            </div>
            <div className="space-y-3">
              {related?.related_internet && related.related_internet.length > 0 ? (
                related.related_internet.map((item, idx) => renderExternalPaper(item, idx))
              ) : (
                <p className="py-6 text-center text-caption text-[var(--muted-foreground)] opacity-50 italic">No recommended papers from web</p>
              )}
            </div>
          </section>
        </TabsContent>
      </Tabs>
    </div>
  );
}

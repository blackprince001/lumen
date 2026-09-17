import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { SearchIcon, PlusIcon } from '@/components/icons';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { PaperCard } from '@/components/PaperCard';
import { ExpandedInput } from '@/components/ExpandedInput';
import { papersApi } from '@/lib/api/papers';
import { routeApi, type RouteDestination, type RouteResult } from '@/lib/api/route';
import { EmptyState } from '@/components/ui/EmptyState';
import { LibraryIllustration } from '@/components/illustrations';

const DEST_LABEL: Record<Exclude<RouteDestination, 'unsupported'>, string> = {
  library_search: 'Your library',
  discovery_search: 'New papers',
  ai_search: 'AI overview',
  deep_research: 'Deep dive',
};

function destTarget(dest: RouteDestination, term: string): { to: string; state?: unknown } {
  const receipt = `via=router&route=${dest}`;
  switch (dest) {
    case 'discovery_search':
    case 'ai_search':
      return { to: '/discovery', state: { routedQuery: term, receipt } };
    case 'deep_research':
      return { to: '/deep-research' };
    case 'library_search':
    case 'unsupported':
    default:
      return { to: `/search?q=${encodeURIComponent(term)}&${receipt}` };
  }
}

export default function Home() {
  const [query, setQuery] = useState('');
  const [routing, setRouting] = useState(false);
  const [suggestions, setSuggestions] = useState<{ result: RouteResult; term: string } | null>(null);
  const navigate = useNavigate();

  const go = (dest: RouteDestination, term: string, conf: number) => {
    const target = destTarget(dest, term);
    if (target.state) {
      navigate(target.to, { state: { ...(target.state as object), conf } });
    } else {
      navigate(`${target.to}${target.to.includes('?') ? '&' : '?'}conf=${conf.toFixed(2)}`);
    }
  };

  const handleSearch = async (q?: string) => {
    const term = (q ?? query).trim();
    if (!term || routing) return;
    // Fail-soft: router error reproduces today's behavior exactly.
    setRouting(true);
    setSuggestions(null);
    try {
      const result = await routeApi.route(term);
      if (result.action === 'suggest') {
        setSuggestions({ result, term });
      } else {
        go(result.destination, term, result.confidence);
      }
    } catch {
      navigate(`/search?q=${encodeURIComponent(term)}`);
    } finally {
      setRouting(false);
    }
  };

  const { data, isLoading } = useQuery({
    queryKey: ['papers', 1, 6, undefined, { sort_by: 'date_added', sort_order: 'desc' }],
    queryFn: () => papersApi.list(1, 6, undefined, { sort_by: 'date_added', sort_order: 'desc' }),
    staleTime: 2 * 60 * 1000,
  });

  const papers = data?.papers ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="min-h-full flex flex-col">
      {/* ── Hero ── */}
      <div className="flex flex-col items-center px-4 sm:px-6 pt-12 sm:pt-20 pb-10 sm:pb-16">
        <div className="mb-6 sm:mb-8 text-center">
          <h1 className="text-section-title sm:text-display font-bold tracking-tight text-(--foreground) leading-none mb-2">
            Lumen
          </h1>
          <p className="text-body sm:text-btn text-(--muted-foreground) max-w-sm mx-auto leading-relaxed">
            Your personal research library
          </p>
        </div>

        {/* Hero search */}
        <div className="w-full max-w-2xl">
          <ExpandedInput
            value={query}
            onChange={(v) => {
              setQuery(v);
              setSuggestions(null);
            }}
            onSubmit={() => handleSearch()}
            placeholder="Search your library..."
            submitLabel="Search"
            submitIcon={<SearchIcon size="sm" />}
            autoFocus
            loading={routing}
            disabled={routing}
          />
          {suggestions && (
            <div className="mt-3 flex flex-wrap items-center gap-2" aria-live="polite">
              <span className="text-caption text-(--muted-foreground)">
                Where should this go?
              </span>
              {(Object.keys(DEST_LABEL) as (keyof typeof DEST_LABEL)[])
                .sort(
                  (a, b) =>
                    (suggestions.result.probabilities[b] ?? 0) -
                    (suggestions.result.probabilities[a] ?? 0),
                )
                .map((dest) => (
                  <button
                    key={dest}
                    type="button"
                    onClick={() => go(dest, suggestions.term, suggestions.result.probabilities[dest] ?? 0)}
                    className="h-8 px-3 text-caption font-medium rounded-lg bg-(--muted) text-(--foreground) hover:bg-(--border) transition-colors"
                  >
                    {DEST_LABEL[dest]}
                    {suggestions.result.probabilities[dest] !== undefined &&
                      ` · ${Math.round(suggestions.result.probabilities[dest] * 100)}%`}
                  </button>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Papers grid ── */}
      <div className="flex-1 px-4 sm:px-6 py-6 sm:py-10">
        <div className="max-w-content mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <h4 className="text-btn font-semibold text-(--foreground)">
              Recent Papers: {total > 0 && ` · ${total} papers`}
            </h4>
            <Link to="/ingest" aria-label="Add paper">
              <Button variant="primary" icon={<PlusIcon size="sm" />} className="px-2.5 sm:px-4">
                <span className="hidden sm:inline">Add Paper</span>
              </Button>
            </Link>
          </div>

          {/* Grid — matches PapersList exactly */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-2xl border border-(--border) p-5 h-44 flex flex-col gap-3">
                  <div className="flex gap-2">
                    <Skeleton className="h-5 w-16 rounded" />
                    <Skeleton className="h-5 w-12 rounded" />
                  </div>
                  <Skeleton className="h-4 w-full rounded" />
                  <Skeleton className="h-4 w-3/4 rounded" />
                  <Skeleton className="h-3 w-1/2 rounded" />
                </div>
              ))}
            </div>
          ) : papers.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {papers.map((paper) => (
                <PaperCard key={paper.id} paper={paper} />
              ))}
            </div>
          ) : (
            <EmptyState
              size="page"
              illustration={LibraryIllustration}
              title="Your library is empty"
              description="Add your first paper to start building your research collection."
              actions={
                <Link to="/ingest">
                  <Button variant="outlined">Add your first paper</Button>
                </Link>
              }
              className="py-20"
            />
          )}

          {/* See all link */}
          {total > 6 && (
            <div className="mt-6 text-center">
              <Link
                to="/papers"
                className="text-code font-medium text-(--muted-foreground) hover:text-(--foreground) transition-colors"
              >
                View all {total} papers →
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

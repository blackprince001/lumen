import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { SearchNormal as Search, ArrowRight, Add as Plus } from 'iconsax-reactjs';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { PaperCard } from '@/components/PaperCard';
import { papersApi } from '@/lib/api/papers';

const QUICK_SEARCHES = [
  'Transformer attention',
  'Diffusion models',
  'RLHF',
  'Graph neural networks',
  'Sparse autoencoders',
];

export default function Home() {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  const handleSearch = (q?: string) => {
    const term = (q ?? query).trim();
    if (term) navigate(`/search?q=${encodeURIComponent(term)}`);
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
      <div className="flex flex-col items-center px-6 pt-20 pb-16">
        <div className="mb-8 text-center">
          <h1 className="text-display font-bold tracking-tight text-[var(--foreground)] leading-none mb-2">
            Papers
          </h1>
          <p className="text-btn text-[var(--muted-foreground)] max-w-sm mx-auto leading-relaxed">
            Your personal research library
          </p>
        </div>

        {/* Hero search */}
        <div className="w-full max-w-2xl">
          <div className="relative flex items-center bg-[var(--white)] border border-[var(--border)] rounded-2xl transition-all duration-200 h-16">
            <Search size={16} className="absolute left-4 text-[var(--muted-foreground)] pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search your library..."
              className="flex-1 h-14 bg-transparent pl-14 pr-4 text-body-lg text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none"
              autoFocus
            />
            <button
              onClick={() => handleSearch()}
              disabled={!query.trim()}
              className="mr-2 h-9 px-4 bg-[var(--foreground)] text-[var(--white)] text-code font-medium rounded-xl flex items-center gap-1.5 disabled:opacity-30 hover:opacity-85 active:opacity-75 transition-opacity"
            >
              Search <ArrowRight size={14} />
            </button>
          </div>

          {/* Quick chips */}
          <div className="mt-3 flex flex-wrap gap-2 justify-center">
            {QUICK_SEARCHES.map((term) => (
              <button
                key={term}
                onClick={() => handleSearch(term)}
                className="h-7 px-3 text-caption font-medium bg-[var(--muted)] text-[var(--muted-foreground)] hover:bg-[var(--border)] hover:text-[var(--foreground)] rounded-full transition-colors"
              >
                {term}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Papers grid ── */}
      <div className="flex-1 px-6 py-10">
        <div className="max-w-content mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <h4 className="text-btn font-semibold text-[var(--foreground)]">
              Library{total > 0 && ` · ${total} papers`}
            </h4>
            <Link to="/ingest">
              <Button variant="primary" icon={<Plus size={13} />} className="!h-7 !px-3 !text-caption">
                Add Paper
              </Button>
            </Link>
          </div>

          {/* Grid — matches PapersList exactly */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-2xl border border-[var(--border)] p-5 h-44 flex flex-col gap-3">
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
            <div className="py-20 text-center">
              <p className="text-[var(--muted-foreground)] mb-4">Your library is empty</p>
              <Link to="/ingest">
                <Button variant="outlined">Add your first paper</Button>
              </Link>
            </div>
          )}

          {/* See all link */}
          {total > 6 && (
            <div className="mt-6 text-center">
              <Link
                to="/papers"
                className="text-code font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
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

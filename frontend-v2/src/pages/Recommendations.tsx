import { useQuery } from '@tanstack/react-query';
import { MagicStar as Sparkles, Refresh as Loader2, Warning2 as AlertCircle, Refresh as RefreshCw } from 'iconsax-reactjs';
import { Link } from 'react-router-dom';
import { discoveryApi } from '@/lib/api/discovery';
import { DiscoveredPaperCard } from '@/components/discovery/DiscoveredPaperCard';
import { Button } from '@/components/ui/Button';

export default function Recommendations() {
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['discovery-recommendations'],
    queryFn: () =>
      discoveryApi.getRecommendations({
        based_on: 'library',
        sources: ['semantic_scholar'],
        limit: 20,
      }),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const recommendations = data?.recommendations || [];

  return (
    <div className="max-w-[60rem] mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-page-title mb-1">Recommended Papers</h1>
        <p className="text-body text-[var(--muted-foreground)]">
          Personalized recommendations based on your library
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between mb-6">
        <div className="text-code text-[var(--muted-foreground)]">
          {data?.total !== undefined && data.total > 0 && (
            <span>Found {data.total} recommendations</span>
          )}
        </div>
        <Button
          variant="ghost"
          onClick={() => refetch()}
          disabled={isFetching}
          icon={<RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />}
        >
          Refresh
        </Button>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-3 text-[var(--muted-foreground)]">
            <Loader2 size={32} className="animate-spin" />
            <span className="text-code">Finding papers you might like...</span>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="text-center py-16">
          <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
          <h2 className="text-body-lg font-bold mb-2">Couldn't load recommendations</h2>
          <p className="text-code text-[var(--muted-foreground)] mb-6 max-w-md mx-auto">
            Make sure you have papers with DOIs in your library. Recommendations are generated based on your existing papers.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Button variant="ghost" onClick={() => refetch()}>
              Try again
            </Button>
            <Link to="/papers">
              <Button variant="primary">Go to Library</Button>
            </Link>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && recommendations.length === 0 && (
        <div className="text-center py-16">
          <Sparkles size={48} className="text-[var(--muted-foreground)] mx-auto mb-4" />
          <h2 className="text-body-lg font-bold mb-2">No recommendations yet</h2>
          <p className="text-code text-[var(--muted-foreground)] mb-6 max-w-md mx-auto">
            Add more papers with DOIs to your library to get personalized recommendations based on your research interests.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link to="/discovery">
              <Button variant="ghost">Discover Papers</Button>
            </Link>
            <Link to="/ingest">
              <Button variant="primary">Add Papers</Button>
            </Link>
          </div>
        </div>
      )}

      {/* Results */}
      {!isLoading && !error && recommendations.length > 0 && (
        <div className="space-y-3">
          {recommendations.map((paper) => (
            <DiscoveredPaperCard key={`${paper.source}-${paper.external_id}`} paper={paper} />
          ))}
        </div>
      )}
    </div>
  );
}

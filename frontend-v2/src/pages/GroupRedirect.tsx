import { Navigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { groupsApi } from '@/lib/api/groups';
import { useAuth } from '@/contexts/AuthContext';
import { buildManifest } from '@/lib/finder/manifest';
import { Skeleton } from '@/components/ui/Skeleton';

/** Maps legacy `/groups/:id` links (sidebar, old deep links) into the Finder. */
export default function GroupRedirect() {
  const { id } = useParams<{ id: string }>();
  const groupId = id ? parseInt(id, 10) : NaN;
  const { user } = useAuth();

  const { data: groups, isLoading } = useQuery({
    queryKey: ['groups'],
    queryFn: () => groupsApi.list(),
  });

  if (isLoading || !groups) {
    return (
      <div className="max-w-content mx-auto px-6 py-8">
        <Skeleton className="h-[60vh] w-full" />
      </div>
    );
  }

  const path = Number.isFinite(groupId)
    ? buildManifest(groups, user?.id).index.pathByGroup.get(groupId)
    : undefined;

  return (
    <Navigate to={path ? `/groups?path=${encodeURIComponent(path)}` : '/groups'} replace />
  );
}

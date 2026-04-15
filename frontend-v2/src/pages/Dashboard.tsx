import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { DocumentText as FileText, Book1 as BookOpen, Clock, TrendUp as TrendingUp, Tag as TagIcon } from 'iconsax-reactjs';
import { statisticsApi } from '@/lib/api/statistics';
import { papersApi } from '@/lib/api/papers';
import { tagsApi } from '@/lib/api/tags';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { PaperCard } from '@/components/PaperCard';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['statistics', 'dashboard'],
    queryFn: () => statisticsApi.getDashboard(),
  });

  const { data: streaks, isLoading: streaksLoading } = useQuery({
    queryKey: ['statistics', 'streaks'],
    queryFn: () => statisticsApi.getReadingStreaks(),
  });

  const { data: recentData } = useQuery({
    queryKey: ['papers', 'recent', 6],
    queryFn: () => papersApi.list(1, 6, undefined, { sort_by: 'date_added', sort_order: 'desc' }),
  });

  const { data: tagsData } = useQuery({
    queryKey: ['tags'],
    queryFn: () => tagsApi.list(1, 20),
  });

  const recentPapers = recentData?.papers ?? [];
  const tags = tagsData?.tags ?? [];
  const currentStreak = streaks?.current_streak ?? 0;
  const longestStreak = streaks?.longest_streak ?? 0;

  // Calculate stats from status_distribution
  const statusDist = stats?.status_distribution ?? {};
  const totalPapers = Object.values(statusDist).reduce((a, b) => a + b, 0);
  const readPapers = statusDist['read'] || 0;
  const readingTimeHours = stats?.total_reading_time_minutes ? Math.round(stats.total_reading_time_minutes / 60) : 0;
  const papersReadThisWeek = stats?.papers_read_this_week ?? 0;

  // Prepare activity chart data (Comparison of time periods)
  const activityData = [
    { name: 'This Week', count: stats?.papers_read_this_week || 0 },
    { name: 'This Month', count: stats?.papers_read_this_month || 0 },
    { name: 'This Year', count: stats?.papers_read_this_year || 0 },
  ];

  // Prepare reading status distribution data
  const statusChartData = Object.entries(statusDist).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1).replace('_', ' '),
    value,
    color: name === 'read' ? '#07BC0C' : name === 'archived' ? '#616664' : name === 'in_progress' ? '#3B82F6' : '#94A3B8'
  }));


  return (
    <div className="max-w-content mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="tracking-tight">Dashboard</h1>
        <p className="text-body text-[var(--muted-foreground)] mt-1">Your research velocity at a glance</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statsLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-8 w-16 mb-2" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))
        ) : (
          <>
            <StatCard
              label="Total Papers"
              value={totalPapers.toString()}
              icon={FileText}
              change={`${totalPapers} items`}
            />
            <StatCard
              label="Read This Week"
              value={readPapers.toString()}
              icon={BookOpen}
              change={`${papersReadThisWeek} this week`}
            />
            <StatCard
              label="Reading Time"
              value={`${readingTimeHours}h`}
              icon={Clock}
              change="Total minutes"
            />
            <StatCard
              label="Current Streak"
              value={currentStreak.toString()}
              icon={TrendingUp}
              change={`Best: ${longestStreak}`}
            />
          </>
        )}
      </div>

      {/* Charts + Streak */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Progress chart */}
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6">
          <h2 className="text-body-lg font-medium mb-4">Reading Progress</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={activityData}>
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--card)',
                  border: '1px solid var(--border)',
                  borderRadius: '0.5rem',
                  fontSize: '0.75rem'
                }}
                formatter={(value: any) => [value, 'Papers Read']}
              />
              <Bar dataKey="count" fill="var(--foreground)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Status distribution pie */}
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6">
          <h2 className="text-body-lg font-medium mb-4">Paper Status</h2>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={statusChartData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
              >
                {statusChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--card)',
                  border: '1px solid var(--border)',
                  borderRadius: '0.5rem',
                  fontSize: '0.75rem'
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 mt-2">
            {statusChartData.map((item) => (
              <div key={item.name} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-caption text-[var(--muted-foreground)]">
                  {item.name}: {item.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Reading streak - full width */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-8 mb-6">
        <h2 className="text-body-lg font-medium mb-6">Reading Streak</h2>

        {streaksLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <div className="flex items-center justify-center py-4">
            <div className="text-center">
              <div className="text-[5.25rem] font-bold text-[var(--foreground)] leading-none mb-3">{currentStreak}</div>
              <div className="text-body-lg text-[var(--muted-foreground)] uppercase tracking-[0.2em] font-medium">
                Day Reading Streak
              </div>
              {longestStreak > currentStreak && (
                <p className="text-body text-[var(--muted-foreground)] mt-4">
                  Personal best: {longestStreak} days
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Recent papers + Tags */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent papers */}
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-body-lg font-medium">Recently Added</h2>
            <Link to="/papers" className="text-caption text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
              View all →
            </Link>
          </div>

          {recentPapers.length === 0 ? (
            <div className="text-center py-8 text-[var(--muted-foreground)]">
              <p className="text-code">No papers yet</p>
              <Link to="/ingest" className="text-caption text-[var(--primary)] hover:underline mt-2 inline-block">
                Add your first paper
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {recentPapers.map((paper) => (
                <PaperCard key={paper.id} paper={paper} />
              ))}
            </div>
          )}
        </div>

        {/* Tags */}
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-body-lg font-medium">Tags</h2>
            <Link to="/papers" className="text-caption text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
              Manage →
            </Link>
          </div>

          {tags.length === 0 ? (
            <div className="text-center py-8 text-[var(--muted-foreground)]">
              <p className="text-code">No tags yet</p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <Badge
                  key={tag.id}
                  variant="secondary"
                  className="text-caption font-medium"
                >
                  <TagIcon size={11} className="mr-1" />
                  {tag.name}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, change }: {
  label: string;
  value: string;
  icon: React.ElementType;
  change: string;
}) {
  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-caption font-medium uppercase tracking-wider text-[var(--muted-foreground)] mb-1">
            {label}
          </p>
          <p className="text-stat text-[var(--foreground)] leading-none mb-2">{value}</p>
          <p className="text-caption text-[var(--muted-foreground)]">{change}</p>
        </div>
        <div className="w-12 h-12 rounded-xl bg-[var(--muted)] flex items-center justify-center">
          <Icon size={22} className="text-[var(--muted-foreground)]" />
        </div>
      </div>
    </div>
  );
}

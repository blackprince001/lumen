import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, subDays, addDays, subMonths, addMonths, isToday, isFuture, parseISO, startOfMonth } from 'date-fns';
import { motion } from 'motion/react';
import { ExportSquare as ExternalLink, Like1 as ThumbsUp, Message as MessageSquare, Refresh as RefreshCw, ArrowLeft2 as ChevronLeft, ArrowRight2 as ChevronRight, ArrowDown2 as ChevronDown, ArrowUp2 as ChevronUp, MagicStar as Sparkles, DocumentText as FileText, Notepad2 as Newspaper, Bookmark2 as BookmarkPlus, Calendar } from 'iconsax-reactjs';
import { huggingfaceApi, type HFPaperItem } from '@/lib/api/huggingface';
import { Button } from '@/components/ui/Button';
import { getPaperTheme } from '@/lib/paper-themes';
import { AddToLibraryDialog } from '@/components/discovery/AddToLibraryDialog';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/Skeleton';

type ViewMode = 'daily' | 'monthly';

function getTodayString() {
  return format(new Date(), 'yyyy-MM-dd');
}

function HFPaperCard({ paper, index = 0 }: { paper: HFPaperItem; index?: number }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const theme = useMemo(() => {
    const hash = paper.paper.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    return getPaperTheme(hash);
  }, [paper.paper.id]);

  const authorNames = paper.paper.authors.filter((a) => !a.hidden).slice(0, 4).map((a) => a.name).join(', ');
  const hasMoreAuthors = paper.paper.authors.filter((a) => !a.hidden).length > 4;
  const paperUrl = paper.paperUrl || `https://huggingface.co/papers/${paper.paper.id}`;
  const summary = paper.paper.ai_summary || paper.summary || paper.paper.summary;

  return (
    <>
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15, ease: 'easeOut', delay: index * 0.03 }}
      className="rounded-2xl border overflow-hidden paper-card-hover flex flex-col"
      style={{ backgroundColor: theme.bg, borderColor: theme.border, '--card-action': theme.action } as React.CSSProperties}
    >
      {/* Thumbnail / header strip */}
      <div className="relative overflow-hidden" style={{ backgroundColor: theme.accent }}>
        {paper.thumbnail
          ? <img src={paper.thumbnail} alt={paper.title} className="w-full h-36 object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          : <div className="h-16 flex items-center justify-center"><FileText size={22} className="opacity-20" style={{ color: theme.text }} /></div>
        }
        <div className="absolute top-2.5 left-3 flex items-center gap-1.5">
          <span className="px-2 py-0.5 bg-white/80 rounded text-caption font-semibold flex items-center gap-1" style={{ color: theme.text }}>
            <ThumbsUp size={11} />{paper.paper.upvotes}
          </span>
          {paper.numComments > 0 && (
            <span className="px-2 py-0.5 bg-white/80 rounded text-caption font-semibold flex items-center gap-1" style={{ color: theme.text }}>
              <MessageSquare size={11} />{paper.numComments}
            </span>
          )}
        </div>
        {/* Add to library */}
        <button
          onClick={(e) => { e.stopPropagation(); setShowDialog(true); }}
          className="absolute top-2.5 right-3 p-1.5 bg-white/80 rounded transition-all hover:bg-white"
          title="Add to library"
          style={{ color: theme.text }}
        >
          <BookmarkPlus size={13} />
        </button>
      </div>

      {/* Inset content area */}
      <div className="rounded-t-xl border-t p-4 flex-1" style={{ backgroundColor: theme.accent, borderColor: theme.border }}>
        <p className="text-caption font-medium mb-2 truncate opacity-60" style={{ color: theme.text }}>
          {paper.organization && <>{paper.organization.fullname} · </>}
          {authorNames}{hasMoreAuthors && ' et al.'}
        </p>

        <h4 className="text-body font-semibold leading-snug line-clamp-2 mb-2" style={{ color: theme.text }}>
          {paper.title}
        </h4>

        {summary && (
          <div className="mb-3">
            <p className={`text-caption leading-relaxed opacity-75 ${isExpanded ? '' : 'line-clamp-2'}`} style={{ color: theme.text }}>
              {summary}
            </p>
            {summary.length > 150 && (
              <button
                onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
                className="flex items-center gap-1 mt-1 text-caption font-medium opacity-50 hover:opacity-80 transition-opacity"
                style={{ color: theme.text }}
              >
                {isExpanded ? <><ChevronUp size={11} />Show less</> : <><ChevronDown size={11} />Read more</>}
              </button>
            )}
          </div>
        )}

        {paper.paper.ai_keywords && paper.paper.ai_keywords.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {paper.paper.ai_keywords.slice(0, 3).map((kw, i) => (
              <span key={i} className="inline-flex items-center gap-1 px-1.5 py-0.5 text-micro font-semibold rounded" style={{ backgroundColor: theme.bg, color: theme.text }}>
                <Sparkles size={9} />{kw}
              </span>
            ))}
            {paper.paper.ai_keywords.length > 3 && (
              <span className="text-micro opacity-40 self-center" style={{ color: theme.text }}>+{paper.paper.ai_keywords.length - 3}</span>
            )}
          </div>
        )}

        <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: theme.border }}>
          <div className="flex items-center gap-3 text-caption opacity-50" style={{ color: theme.text }}>
            {paper.paper.githubRepo && (
              <a href={paper.paper.githubRepo} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="hover:opacity-100 transition-opacity">
                GitHub{paper.paper.githubStars !== undefined && ` ⭐${paper.paper.githubStars}`}
              </a>
            )}
            {paper.paper.projectPage && (
              <a href={paper.paper.projectPage} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="flex items-center gap-1 hover:opacity-100 transition-opacity">
                <ExternalLink size={11} />Project
              </a>
            )}
          </div>
          <a href={paperUrl} target="_blank" rel="noopener noreferrer" className="text-caption font-semibold opacity-60 hover:opacity-100 transition-opacity" style={{ color: theme.text }}>
            View paper →
          </a>
        </div>
      </div>
    </motion.article>

      {showDialog && (
        <AddToLibraryDialog
          paper={{ title: paper.title, url: paperUrl }}
          onClose={() => setShowDialog(false)}
        />
      )}
    </>
  );
}

export default function HuggingFacePapers() {
  const [viewMode, setViewMode] = useState<ViewMode>('daily');
  const [selectedDate, setSelectedDate] = useState(getTodayString());
  const parsedDate = parseISO(selectedDate);
  const isTodaySelected = isToday(parsedDate);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['huggingface-papers', selectedDate],
    queryFn: () => huggingfaceApi.fetchDailyPapers(selectedDate),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  // Daily nav
  const goBack = () => setSelectedDate(format(subDays(parsedDate, 1), 'yyyy-MM-dd'));
  const goForward = () => { const next = addDays(parsedDate, 1); if (!isFuture(next)) setSelectedDate(format(next, 'yyyy-MM-dd')); };

  // Monthly nav — jump to first of month
  const goMonthBack = () => setSelectedDate(format(startOfMonth(subMonths(parsedDate, 1)), 'yyyy-MM-dd'));
  const goMonthForward = () => {
    const next = startOfMonth(addMonths(parsedDate, 1));
    if (!isFuture(next)) setSelectedDate(format(next, 'yyyy-MM-dd'));
  };

  const dateLabel = viewMode === 'daily'
    ? format(parsedDate, 'EEEE, MMMM d, yyyy')
    : format(parsedDate, 'MMMM yyyy');

  return (
    <div className="max-w-[60rem] mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-6 sm:mb-8">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5 mb-1">
            <Newspaper size={22} className="text-[var(--muted-foreground)] shrink-0" />
            <h1 className="tracking-tight">Daily Papers</h1>
          </div>
          <p className="text-body text-[var(--muted-foreground)]">Community-curated research from Hugging Face</p>
        </div>
        <Button
          variant="secondary"
          icon={<ExternalLink size={14} />}
          className="!h-9 text-code px-2.5 sm:px-3 shrink-0"
          onClick={() => window.open('https://huggingface.co/papers', '_blank')}
          aria-label="View on Hugging Face"
        >
          <span className="hidden sm:inline">View on HF</span>
        </Button>
      </div>

      {/* View mode + Date Navigation */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-3 sm:p-4 mb-6">
        {/* View mode toggle */}
        <div className="flex items-center gap-2 mb-4">
          {(['daily', 'monthly'] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-caption font-medium border transition-colors',
                viewMode === mode
                  ? 'bg-[var(--foreground)] text-[var(--white)] border-[var(--foreground)]'
                  : 'bg-transparent text-[var(--muted-foreground)] border-[var(--border)] hover:text-[var(--foreground)]'
              )}
            >
              <Calendar size={13} />
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>

        {/* Date nav */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-body font-semibold text-[var(--foreground)]">{dateLabel}</span>
            {isTodaySelected && (
              <span className="px-2 py-0.5 bg-[var(--muted)] text-[var(--muted-foreground)] text-caption font-medium rounded border border-[var(--border)]">Today</span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="secondary"
              className="!h-8 !px-2 sm:!px-3 !text-caption"
              icon={<ChevronLeft size={13} />}
              onClick={viewMode === 'daily' ? goBack : goMonthBack}
              aria-label={viewMode === 'daily' ? 'Previous day' : 'Previous month'}
            >
              <span className="hidden sm:inline">{viewMode === 'daily' ? 'Prev' : 'Prev Month'}</span>
            </Button>
            {!isTodaySelected && (
              <Button variant="secondary" className="!h-8 !px-2 sm:!px-3 !text-caption" onClick={() => setSelectedDate(getTodayString())}>
                {viewMode === 'daily' ? 'Today' : 'This Month'}
              </Button>
            )}
            <Button
              variant="secondary"
              className="!h-8 !px-2 sm:!px-3 !text-caption"
              disabled={isTodaySelected}
              onClick={viewMode === 'daily' ? goForward : goMonthForward}
              aria-label={viewMode === 'daily' ? 'Next day' : 'Next month'}
            >
              <span className="hidden sm:inline">{viewMode === 'daily' ? 'Next' : 'Next Month'}</span>
              <ChevronRight size={13} />
            </Button>
          </div>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-[var(--border)] overflow-hidden">
              {/* Header skeleton */}
              <div className="h-16 bg-[var(--muted)]" />
              {/* Inset content skeleton */}
              <div className="rounded-t-xl border-t border-[var(--border)] bg-[var(--card)] p-4 space-y-3">
                <Skeleton className="h-3 w-40" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-2/3" />
                <div className="flex gap-1.5 pt-1">
                  <Skeleton className="h-5 w-16 rounded" />
                  <Skeleton className="h-5 w-14 rounded" />
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-[var(--border)]">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="text-center py-12">
          <div className="inline-block px-6 py-4 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-body font-semibold text-red-800 mb-1">Failed to load papers</p>
            <p className="text-caption text-red-600 mb-4">{error instanceof Error ? error.message : 'An error occurred'}</p>
            <Button variant="secondary" icon={<RefreshCw size={14} />} onClick={() => refetch()}>Try Again</Button>
          </div>
        </div>
      )}

      {/* Results */}
      {!isLoading && !isError && data && (
        <>
          <div className="flex items-center justify-between mb-6">
            <p className="text-code text-[var(--muted-foreground)]">
              <span className="font-semibold text-[var(--foreground)]">{data.total_count}</span> paper{data.total_count !== 1 ? 's' : ''}
            </p>
            <button onClick={() => refetch()} className="flex items-center gap-1 text-caption text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors">
              <RefreshCw size={13} />Refresh
            </button>
          </div>

          {data.papers.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.papers.map((paper, i) => <HFPaperCard key={paper.paper.id} paper={paper} index={i} />)}
            </div>
          ) : (
            <div className="text-center py-16">
              <p className="text-btn font-medium text-[var(--foreground)] mb-1">No papers for this {viewMode === 'daily' ? 'date' : 'month'}</p>
              <p className="text-code text-[var(--muted-foreground)]">Try selecting a different {viewMode === 'daily' ? 'date' : 'month'}.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

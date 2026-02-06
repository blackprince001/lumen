/**
 * HuggingFace Daily Papers Page
 *
 * UI State Machine:
 *   [Loading] --Data fetched--> [Loaded]
 *   [Loading] --Fetch failed--> [Error]
 *   [Loaded] --Date change--> [Loading]
 *   [Error] --Retry--> [Loading]
 */

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, subDays, addDays, subMonths, addMonths, isToday, isFuture, parseISO, startOfMonth, endOfMonth } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { ExternalLink, ThumbsUp, MessageSquare, RefreshCw, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Sparkles, Loader2, FileText, Calendar } from 'lucide-react';
import { huggingfaceApi, type HFPaperItem } from '@/lib/api/huggingface';

type PageState = 'loading' | 'loaded' | 'error';
type ViewMode = 'daily' | 'monthly';

// Card color themes matching PaperCard style - applied to content area
const CARD_THEMES = [
  { bg: 'var(--card-bg-olive)', border: '#d4d0c0' },
  { bg: 'var(--card-bg-beige)', border: '#e5e0d8' },
  { bg: 'var(--card-bg-blue)', border: '#cdd8e0' },
  { bg: 'var(--card-bg-yellow)', border: '#e0d8c0' },
  { bg: 'var(--card-bg-pink)', border: '#e8d8d8' },
  { bg: 'var(--card-bg-green)', border: '#d0d8c8' },
  { bg: 'var(--card-bg-tan)', border: '#d8ccc0' },
];

function getTodayString(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

function HFPaperCard({ paper, index = 0 }: { paper: HFPaperItem; index?: number }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const theme = useMemo(() => {
    const hash = paper.paper.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return CARD_THEMES[hash % CARD_THEMES.length];
  }, [paper.paper.id]);

  const authorNames = paper.paper.authors
    .filter((a) => !a.hidden)
    .slice(0, 4)
    .map((a) => a.name)
    .join(', ');

  const hasMoreAuthors = paper.paper.authors.filter((a) => !a.hidden).length > 4;
  const paperUrl = paper.paperUrl || `https://huggingface.co/papers/${paper.paper.id}`;
  const summary = paper.paper.ai_summary || paper.summary || paper.paper.summary;

  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.15,
        ease: 'easeOut',
        delay: index * 0.03
      }}
      className="rounded-lg overflow-hidden cursor-pointer group transition-shadow duration-200 hover:shadow-md"
      style={{ backgroundColor: theme.bg, borderColor: theme.border, borderWidth: '1px', borderStyle: 'solid' }}
    >
      {/* Thumbnail Header - neutral background */}
      {paper.thumbnail && (
        <div className="relative h-36 bg-grayscale-8 overflow-hidden">
          <img
            src={paper.thumbnail}
            alt={paper.title}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
          {/* Upvotes Badge */}
          <span className="absolute top-3 left-3 px-2.5 py-1 bg-white/90 backdrop-blur-sm rounded-md text-xs font-medium text-green-38 shadow-sm flex items-center gap-1">
            <ThumbsUp className="w-3 h-3" />
            {paper.paper.upvotes}
          </span>

          {/* Comments Badge */}
          {paper.numComments > 0 && (
            <span className="absolute top-3 right-3 px-2.5 py-1 bg-white/90 backdrop-blur-sm rounded-md text-xs font-medium text-green-38 shadow-sm flex items-center gap-1">
              <MessageSquare className="w-3 h-3" />
              {paper.numComments}
            </span>
          )}
        </div>
      )}

      {/* No thumbnail - show icon with stats */}
      {!paper.thumbnail && (
        <div className="relative h-24 flex items-center justify-center">
          <FileText className="w-10 h-10 text-green-28 opacity-50" />
          {/* Upvotes Badge */}
          <span className="absolute top-3 left-3 px-2.5 py-1 bg-white/80 rounded-md text-xs font-medium text-green-38 shadow-sm flex items-center gap-1">
            <ThumbsUp className="w-3 h-3" />
            {paper.paper.upvotes}
          </span>

          {/* Comments Badge */}
          {paper.numComments > 0 && (
            <span className="absolute top-3 right-3 px-2.5 py-1 bg-white/80 rounded-md text-xs font-medium text-green-38 shadow-sm flex items-center gap-1">
              <MessageSquare className="w-3 h-3" />
              {paper.numComments}
            </span>
          )}
        </div>
      )}

      {/* Card Content - colored background */}
      <div className="p-5">
        {/* Organization & Author */}
        <div className="flex items-center gap-2 text-xs text-green-34 mb-2">
          {paper.organization && (
            <>
              {paper.organization.avatar && (
                <img
                  src={paper.organization.avatar}
                  alt={paper.organization.fullname}
                  className="w-4 h-4 rounded"
                />
              )}
              <span className="font-medium text-green-38">{paper.organization.fullname}</span>
              <span className="text-green-20">•</span>
            </>
          )}
          <span className="truncate">
            {authorNames}
            {hasMoreAuthors && ' et al.'}
          </span>
        </div>

        {/* Title */}
        <h3 className="text-base font-semibold line-clamp-2 text-green-38 mb-3 leading-snug group-hover:text-blue-43 transition-colors">
          {paper.title}
        </h3>

        {/* Expandable Summary */}
        {summary && (
          <div className="mb-4">
            <AnimatePresence mode="wait">
              <motion.div
                key={isExpanded ? 'expanded' : 'collapsed'}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <p className={`text-sm text-green-34 ${isExpanded ? '' : 'line-clamp-2'}`}>
                  {summary}
                </p>
              </motion.div>
            </AnimatePresence>
            {summary.length > 150 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded(!isExpanded);
                }}
                className="flex items-center gap-1 mt-2 text-xs text-blue-43 hover:text-blue-51 transition-colors font-medium"
              >
                {isExpanded ? (
                  <>
                    <ChevronUp className="w-3.5 h-3.5" />
                    Show less
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3.5 h-3.5" />
                    Read more
                  </>
                )}
              </button>
            )}
          </div>
        )}

        {/* AI Keywords */}
        {paper.paper.ai_keywords && paper.paper.ai_keywords.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {paper.paper.ai_keywords.slice(0, 3).map((keyword, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-white/60 text-green-38 rounded"
              >
                <Sparkles className="w-3 h-3" />
                {keyword}
              </span>
            ))}
            {paper.paper.ai_keywords.length > 3 && (
              <span className="px-2 py-0.5 text-xs text-green-28">
                +{paper.paper.ai_keywords.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Links Row */}
        <div className="flex items-center justify-between pt-3 border-t border-white/50">
          <div className="flex items-center gap-3 text-xs">
            {paper.paper.githubRepo && (
              <a
                href={paper.paper.githubRepo}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-green-34 hover:text-green-38 transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                GitHub
                {paper.paper.githubStars !== undefined && (
                  <span className="text-yellow-600">⭐ {paper.paper.githubStars}</span>
                )}
              </a>
            )}
            {paper.paper.projectPage && (
              <a
                href={paper.paper.projectPage}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-green-34 hover:text-green-38 transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Project
              </a>
            )}
          </div>

          {/* View Paper Link */}
          <a
            href={paperUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-blue-43 hover:text-blue-51 transition-colors font-medium text-sm"
            onClick={(e) => e.stopPropagation()}
          >
            View Paper →
          </a>
        </div>
      </div>
    </motion.article>
  );
}

export default function HuggingFacePapers() {
  const [selectedDate, setSelectedDate] = useState<string>(getTodayString());
  const [viewMode, setViewMode] = useState<ViewMode>('daily');
  const parsedDate = parseISO(selectedDate);
  const isTodaySelected = isToday(parsedDate);

  // Fetch papers for selectedDate
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['huggingface-papers', selectedDate],
    queryFn: () => huggingfaceApi.fetchDailyPapers(selectedDate),
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });

  // Derive page state
  const pageState: PageState = useMemo(() => {
    if (isLoading) return 'loading';
    if (isError) return 'error';
    return 'loaded';
  }, [isLoading, isError]);

  // Daily navigation
  const goToPreviousDay = () => {
    const newDate = subDays(parsedDate, 1);
    setSelectedDate(format(newDate, 'yyyy-MM-dd'));
  };

  const goToNextDay = () => {
    const newDate = addDays(parsedDate, 1);
    if (!isFuture(newDate))
    {
      setSelectedDate(format(newDate, 'yyyy-MM-dd'));
    }
  };

  // Monthly navigation
  const goToPreviousMonth = () => {
    const newDate = subMonths(parsedDate, 1);
    setSelectedDate(format(startOfMonth(newDate), 'yyyy-MM-dd'));
  };

  const goToNextMonth = () => {
    const newDate = addMonths(parsedDate, 1);
    const monthEnd = endOfMonth(newDate);
    if (!isFuture(startOfMonth(newDate)))
    {
      if (isFuture(monthEnd))
      {
        setSelectedDate(getTodayString());
      } else
      {
        setSelectedDate(format(startOfMonth(newDate), 'yyyy-MM-dd'));
      }
    }
  };

  const goToToday = () => {
    setSelectedDate(getTodayString());
  };

  return (
    <div className="w-full bg-anara-light-bg min-h-screen">
      <div className="container py-8 sm:py-12">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl sm:text-4xl font-medium text-anara-light-text mb-2">
              HuggingFace Daily Papers
            </h1>
            <p className="text-green-34 max-w-lg mx-auto">
              Discover the latest AI/ML research papers featured on HuggingFace
            </p>
          </div>

          {/* View Mode Toggle & Date Navigation */}
          <div className="bg-grayscale-8 border border-green-6 rounded-lg p-4 mb-8">
            {/* View Mode Toggle */}
            <div className="flex items-center justify-center gap-2 mb-4">
              <button
                onClick={() => setViewMode('daily')}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${viewMode === 'daily'
                    ? 'bg-green-4 text-green-38 border border-green-28'
                    : 'text-green-34 hover:bg-green-4 border border-transparent'
                  }`}
              >
                <Calendar className="w-4 h-4" />
                Daily
              </button>
              <button
                onClick={() => setViewMode('monthly')}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${viewMode === 'monthly'
                    ? 'bg-green-4 text-green-38 border border-green-28'
                    : 'text-green-34 hover:bg-green-4 border border-transparent'
                  }`}
              >
                <Calendar className="w-4 h-4" />
                Monthly
              </button>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              {/* Date Display */}
              <div className="flex items-center gap-3">
                <span className="text-xl font-semibold text-anara-light-text">
                  {viewMode === 'daily'
                    ? format(parsedDate, 'EEEE, MMMM d, yyyy')
                    : format(parsedDate, 'MMMM yyyy')
                  }
                </span>
                {isTodaySelected && (
                  <span className="px-2 py-0.5 bg-blue-14 text-blue-38 text-xs font-medium rounded">
                    Today
                  </span>
                )}
              </div>

              {/* Navigation Buttons */}
              <div className="flex items-center gap-2">
                {viewMode === 'daily' ? (
                  <>
                    <button
                      onClick={goToPreviousDay}
                      className="flex items-center gap-1 px-3 py-1.5 bg-green-4 text-green-38 border border-green-6 rounded-lg hover:bg-green-6 transition-colors text-sm"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Previous Day
                    </button>
                    {!isTodaySelected && (
                      <button
                        onClick={goToToday}
                        className="px-3 py-1.5 bg-blue-14 text-blue-38 border border-blue-20 rounded-lg hover:bg-blue-20 transition-colors text-sm font-medium"
                      >
                        Today
                      </button>
                    )}
                    <button
                      onClick={goToNextDay}
                      disabled={isTodaySelected}
                      className="flex items-center gap-1 px-3 py-1.5 bg-green-4 text-green-38 border border-green-6 rounded-lg hover:bg-green-6 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                    >
                      Next Day
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={goToPreviousMonth}
                      className="flex items-center gap-1 px-3 py-1.5 bg-green-4 text-green-38 border border-green-6 rounded-lg hover:bg-green-6 transition-colors text-sm"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Previous Month
                    </button>
                    {!isTodaySelected && (
                      <button
                        onClick={goToToday}
                        className="px-3 py-1.5 bg-blue-14 text-blue-38 border border-blue-20 rounded-lg hover:bg-blue-20 transition-colors text-sm font-medium"
                      >
                        This Month
                      </button>
                    )}
                    <button
                      onClick={goToNextMonth}
                      disabled={isFuture(startOfMonth(addMonths(parsedDate, 1)))}
                      className="flex items-center gap-1 px-3 py-1.5 bg-green-4 text-green-38 border border-green-6 rounded-lg hover:bg-green-6 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                    >
                      Next Month
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Loading State */}
          {pageState === 'loading' && (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="w-10 h-10 text-green-28 animate-spin mb-4" />
              <p className="text-green-34">Loading papers for {format(parsedDate, 'MMM d, yyyy')}...</p>
            </div>
          )}

          {/* Error State */}
          {pageState === 'error' && (
            <div className="text-center py-12">
              <div className="inline-block px-6 py-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-800 font-medium mb-2">Failed to load papers</p>
                <p className="text-sm text-red-600 mb-4">
                  {error instanceof Error ? error.message : 'An error occurred'}
                </p>
                <button
                  onClick={() => refetch()}
                  className="flex items-center gap-2 mx-auto px-4 py-2 bg-red-100 text-red-800 rounded-lg hover:bg-red-200 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Try Again
                </button>
              </div>
            </div>
          )}

          {/* Loaded State */}
          {pageState === 'loaded' && data && (
            <>
              {/* Results Summary */}
              <div className="mb-6 flex items-center justify-between">
                <div className="text-sm text-green-34">
                  Found <span className="font-semibold text-anara-light-text">{data.total_count}</span>{' '}
                  paper{data.total_count !== 1 ? 's' : ''}
                </div>
                <button
                  onClick={() => refetch()}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs text-green-28 hover:text-green-38 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Refresh
                </button>
              </div>

              {/* Papers Grid */}
              {data.papers.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {data.papers.map((paper, index) => (
                    <HFPaperCard key={paper.paper.id} paper={paper} index={index} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-16">
                  <p className="text-lg font-medium text-green-38 mb-2">No papers for this date</p>
                  <p className="text-sm text-green-34">
                    Try selecting a different date or check back later.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

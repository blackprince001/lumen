import { motion, AnimatePresence } from 'motion/react';
import { TickCircle as Check, Refresh as Loader2 } from 'iconsax-reactjs';
import { cn } from '@/lib/utils';
import type { SearchStatus, TimelineEntry } from '@/hooks/use-ai-search-stream';

interface DiscoveryStatusProps {
  status: SearchStatus | null;
  timeline: TimelineEntry[];
  isSearching: boolean;
}

const STAGE_LABEL: Record<string, string> = {
  starting: 'Initializing',
  understanding: 'Understanding query',
  searching: 'Searching sources',
  source_results: 'Source complete',
  analyzing: 'Analyzing results',
  enhancing: 'Generating insights',
  overview: 'Building overview',
  clustering: 'Clustering topics',
  relevance: 'Ranking relevance',
  complete: 'Complete',
};

export function DiscoveryStatus({ status, timeline, isSearching }: DiscoveryStatusProps) {
  if (!isSearching && (!status || status.stage === 'complete')) return null;

  const progress = Math.max(0, Math.min(100, status?.progress ?? 0));
  const headline = status?.message || 'Searching…';
  const stageLabel = STAGE_LABEL[status?.stage ?? 'starting'] ?? 'Searching';

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.18 }}
      className="bg-[var(--card)] border border-[var(--border)] rounded-xl mb-6 overflow-hidden"
    >
      <div className="px-5 pt-4 pb-3">
        <div className="flex items-baseline justify-between gap-4 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            {isSearching ? (
              <Loader2 size={13} className="text-[var(--muted-foreground)] animate-spin shrink-0" />
            ) : (
              <Check size={13} className="text-[var(--foreground)] shrink-0" />
            )}
            <span className="text-caption uppercase tracking-wider text-[var(--muted-foreground)] font-medium shrink-0">
              {stageLabel}
            </span>
            {status?.source && (
              <>
                <span className="text-[var(--border)]">·</span>
                <span className="text-caption text-[var(--foreground)] truncate">
                  {status.source}
                </span>
              </>
            )}
          </div>
          <span className="text-caption text-[var(--muted-foreground)] tabular-nums shrink-0">
            {progress}%
          </span>
        </div>

        <p className="text-code text-[var(--foreground)] leading-snug">
          {headline}
        </p>
      </div>

      <div className="relative h-px w-full bg-[var(--border)]">
        <motion.div
          className="absolute top-0 left-0 h-full bg-[var(--foreground)]"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ type: 'tween', duration: 0.25, ease: 'easeOut' }}
        />
      </div>

      {timeline.length > 0 && (
        <ol className="px-5 py-3 space-y-1.5 max-h-48 overflow-y-auto">
          <AnimatePresence initial={false}>
            {timeline.map((entry, idx) => {
              const isLast = idx === timeline.length - 1;
              return (
                <motion.li
                  key={entry.id}
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.15 }}
                  className="flex items-start gap-2.5 text-code"
                >
                  <span
                    className={cn(
                      'mt-1.5 w-1 h-1 rounded-full shrink-0',
                      isLast && isSearching
                        ? 'bg-[var(--foreground)]'
                        : 'bg-[var(--muted-foreground)] opacity-50'
                    )}
                  />
                  <span
                    className={cn(
                      'truncate',
                      isLast && isSearching
                        ? 'text-[var(--foreground)]'
                        : 'text-[var(--muted-foreground)]'
                    )}
                  >
                    {entry.message}
                  </span>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ol>
      )}
    </motion.div>
  );
}

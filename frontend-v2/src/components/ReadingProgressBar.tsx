import { Progress } from '@/components/ui/Progress';
import { cn } from '@/lib/utils';

interface ReadingProgressBarProps {
  currentPage?: number;
  totalPages?: number;
  readingTimeMinutes?: number;
  className?: string;
}

export function ReadingProgressBar({ currentPage, totalPages, readingTimeMinutes, className }: ReadingProgressBarProps) {
  const hasPageProgress = currentPage !== undefined && totalPages !== undefined && totalPages > 0;
  const pct = hasPageProgress ? Math.min((currentPage! / totalPages!) * 100, 100) : 0;

  const hours = readingTimeMinutes ? Math.floor(readingTimeMinutes / 60) : 0;
  const mins = readingTimeMinutes ? readingTimeMinutes % 60 : 0;
  const readingLabel = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

  return (
    <div className={cn('space-y-1.5', className)}>
      {hasPageProgress && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-caption text-[var(--muted-foreground)]">
            <span>Page {currentPage} of {totalPages}</span>
            <span>{Math.round(pct)}%</span>
          </div>
          <Progress value={pct} />
        </div>
      )}
      {readingTimeMinutes !== undefined && readingTimeMinutes > 0 && (
        <p className="text-caption text-[var(--muted-foreground)]">
          Reading time: {readingLabel}
        </p>
      )}
    </div>
  );
}

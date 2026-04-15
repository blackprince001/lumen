import { cn } from '@/lib/utils';

interface ProgressProps {
  value: number; // 0–100
  className?: string;
  trackClassName?: string;
  fillClassName?: string;
}

export function Progress({ value, className, trackClassName, fillClassName }: ProgressProps) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn('relative w-full overflow-hidden rounded-pill bg-[var(--muted)]', 'h-1', className)}
    >
      <div
        className={cn('h-full rounded-pill bg-[var(--primary)] transition-all duration-300', trackClassName, fillClassName)}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

import { CloseCircle as X } from 'iconsax-reactjs';
import { cn } from '@/lib/utils';

interface FilterChipProps {
  label: string;
  value: string;
  onRemove: () => void;
  className?: string;
}

export function FilterChip({ label, value, onRemove, className }: FilterChipProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1.5',
        'bg-[var(--muted)] rounded-lg',
        'text-caption text-[var(--foreground)]',
        className,
      )}
    >
      <span className="text-[var(--muted-foreground)] font-medium">{label}:</span>
      <span className="font-medium">{value}</span>
      <button
        onClick={onRemove}
        aria-label={`Remove ${label} filter`}
        className="ml-0.5 rounded-full p-0.5 hover:bg-[var(--border)] transition-colors"
      >
        <X size={11} />
      </button>
    </span>
  );
}

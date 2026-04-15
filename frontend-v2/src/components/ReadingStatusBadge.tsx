import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';

type ReadingStatus = 'not_started' | 'in_progress' | 'read' | 'archived';

interface ReadingStatusBadgeProps {
  status: ReadingStatus;
  className?: string;
}

const STATUS_CONFIG: Record<ReadingStatus, { label: string; className: string }> = {
  not_started: { label: 'Not Started', className: 'bg-[var(--muted)] text-[var(--muted-foreground)]' },
  in_progress:  { label: 'In Progress', className: 'bg-[rgba(60,145,230,0.12)] text-[var(--sky-blue)]' },
  read:         { label: 'Read',        className: 'bg-[rgba(7,188,12,0.10)] text-[var(--success-green)]' },
  archived:     { label: 'Archived',    className: 'bg-[var(--muted)] text-[var(--muted-foreground)] opacity-70' },
};

export function ReadingStatusBadge({ status, className }: ReadingStatusBadgeProps) {
  const { label, className: variantClass } = STATUS_CONFIG[status];
  return (
    <Badge className={cn(variantClass, className)}>
      {label}
    </Badge>
  );
}

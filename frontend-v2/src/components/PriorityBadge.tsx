import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';

type Priority = 'low' | 'medium' | 'high' | 'critical';

interface PriorityBadgeProps {
  priority: Priority;
  className?: string;
}

const PRIORITY_CONFIG: Record<Priority, { label: string; className: string }> = {
  low:      { label: 'Low',      className: 'bg-[var(--muted)] text-[var(--muted-foreground)]' },
  medium:   { label: 'Medium',   className: 'bg-[rgba(228,91,60,0.10)] text-[var(--coral-red)]' },
  high:     { label: 'High',     className: 'bg-[rgba(228,91,60,0.18)] text-[var(--coral-red)]' },
  critical: { label: 'Critical', className: 'bg-[rgba(209,46,62,0.12)] text-[var(--destructive)]' },
};

export function PriorityBadge({ priority, className }: PriorityBadgeProps) {
  const { label, className: variantClass } = PRIORITY_CONFIG[priority];
  return (
    <Badge className={cn(variantClass, className)}>
      {label}
    </Badge>
  );
}

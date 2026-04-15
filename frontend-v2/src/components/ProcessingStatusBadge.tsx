import { Refresh as Loader2 } from 'iconsax-reactjs';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';

type ProcessingStatus = 'pending' | 'processing' | 'completed' | 'failed';

interface ProcessingStatusBadgeProps {
  status: ProcessingStatus;
  className?: string;
}

export function ProcessingStatusBadge({ status, className }: ProcessingStatusBadgeProps) {
  if (status === 'completed' || status === 'pending') return null;

  const isProcessing = status === 'processing';

  return (
    <Badge
      className={cn(
        isProcessing
          ? 'bg-[rgba(60,145,230,0.12)] text-[var(--sky-blue)]'
          : 'bg-[rgba(209,46,62,0.12)] text-[var(--destructive)]',
        className,
      )}
    >
      {isProcessing && <Loader2 size={10} className="mr-1 animate-spin" />}
      {isProcessing ? 'Processing' : 'Failed'}
    </Badge>
  );
}

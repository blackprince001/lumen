import { type HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type BadgeVariant = 'default' | 'success' | 'info' | 'warning' | 'secondary';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-[var(--muted)] text-[var(--foreground)]',
  success: 'bg-[rgba(7,188,12,0.1)] text-[var(--success-green)]',
  info: 'bg-[rgba(60,145,230,0.1)] text-[var(--sky-blue)]',
  warning: 'bg-[rgba(228,91,60,0.1)] text-[var(--coral-red)]',
  secondary: 'bg-[var(--muted)] text-[var(--foreground)]',
};

export function Badge({ variant = 'default', className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center',
        'text-caption px-2 py-0.5',
        'rounded-badge',
        variantStyles[variant],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}

import { type HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type CardVariant = 'feature' | 'tour' | 'flat';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
}

const variantStyles: Record<CardVariant, string> = {
  feature: cn(
    'bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-none',
    'hover:shadow-[0_2px_8px_rgba(0,0,0,0.08)] transition-shadow duration-200',
  ),
  tour: cn(
    'bg-[var(--white)] rounded-xl border border-[var(--border)] shadow-none',
  ),
  flat: cn(
    'bg-[var(--white)] rounded-xl shadow-none',
  ),
};

export function Card({ variant = 'feature', className, children, ...props }: CardProps) {
  return (
    <div className={cn(variantStyles[variant], className)} {...props}>
      {children}
    </div>
  );
}

export function CardImage({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('rounded-t-xl overflow-hidden', className)} {...props}>
      {children}
    </div>
  );
}

export function CardContent({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('px-6 pb-6 pt-5', className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ className, children, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn('text-btn font-bold text-[var(--foreground)]', className)} {...props}>
      {children}
    </h3>
  );
}

export function CardDescription({ className, children, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn('text-code font-normal text-[var(--muted-foreground)] leading-relaxed mt-1', className)} {...props}>
      {children}
    </p>
  );
}

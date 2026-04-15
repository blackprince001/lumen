import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ error, className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          'w-full bg-[var(--card)] text-[var(--foreground)]',
          'text-code font-normal leading-5',
          'px-3 py-2 h-9',
          'rounded-lg',
          'border border-[var(--border)]',
          'placeholder:text-[var(--muted-foreground)]',
          'focus:outline-none focus:border-[var(--ring)] focus:ring-2 focus:ring-[var(--ring)]/10',
          'transition-all duration-150',
          error && 'border-[var(--destructive)] focus:border-[var(--destructive)]',
          className,
        )}
        {...props}
      />
    );
  },
);

Input.displayName = 'Input';

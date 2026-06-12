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
          'w-full bg-(--card) text-(--foreground)',
          'text-code font-normal leading-5',
          'px-3 py-2 h-9',
          'rounded-lg',
          'border border-(--border)',
          'placeholder:text-(--muted-foreground)',
          'focus:outline-none focus:border-(--ring) focus:ring-2 focus:ring-(--ring)/10',
          'transition-all duration-150',
          error && 'border-(--destructive) focus:border-(--destructive)',
          className,
        )}
        {...props}
      />
    );
  },
);

Input.displayName = 'Input';

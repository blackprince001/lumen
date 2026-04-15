import { forwardRef, type SelectHTMLAttributes } from 'react';
import { ArrowDown2 as ChevronDown } from 'iconsax-reactjs';
import { cn } from '@/lib/utils';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ error, className, children, ...props }, ref) => (
    <div className="relative inline-flex w-full">
      <select
        ref={ref}
        className={cn(
          'w-full appearance-none bg-[var(--card)] text-[var(--foreground)]',
          'text-code font-normal leading-5',
          'pl-3 pr-8 py-2 h-9',
          'rounded-lg border border-[var(--border)]',
          'focus:outline-none focus:border-[var(--ring)] focus:ring-2 focus:ring-[var(--ring)]/10',
          'cursor-pointer transition-all duration-150',
          '[&>option]:bg-[var(--card)] [&>option]:text-[var(--foreground)]',
          error && 'border-[var(--destructive)]',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        size={14}
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
      />
    </div>
  ),
);
Select.displayName = 'Select';

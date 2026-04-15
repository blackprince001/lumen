import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ error, className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'w-full bg-[var(--card)] text-[var(--foreground)]',
        'text-code font-normal leading-[1.225rem]',
        'px-3 py-2 rounded-lg',
        'border border-[var(--border)]',
        'placeholder:text-[var(--muted-foreground)]',
        'focus:outline-none focus:border-[var(--ring)] focus:ring-2 focus:ring-[var(--ring)]/10',
        'resize-none transition-all duration-150',
        error && 'border-[var(--destructive)] focus:border-[var(--destructive)]',
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = 'Textarea';

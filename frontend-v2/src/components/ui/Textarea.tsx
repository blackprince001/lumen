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
        'w-full bg-(--card) text-(--foreground)',
        'text-code font-normal leading-[1.225rem]',
        'px-3 py-2 rounded-lg',
        'border border-(--border)',
        'placeholder:text-(--muted-foreground)',
        'focus:outline-none focus:border-(--ring) focus:ring-2 focus:ring-(--ring)/10',
        'resize-none transition-all duration-150',
        error && 'border-(--destructive) focus:border-(--destructive)',
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = 'Textarea';

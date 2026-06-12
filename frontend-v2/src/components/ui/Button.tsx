import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type ButtonVariant = 'primary' | 'primary-lg' | 'secondary' | 'ghost' | 'outlined' | 'destructive';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg' | 'icon' | string;
  icon?: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: cn(
    'bg-(--primary) [color:var(--primary-foreground)]',
    'text-code font-medium h-8 px-5',
    'rounded-lg border border-transparent',
    'hover:opacity-90',
    'active:translate-y-px',
  ),
  'primary-lg': cn(
    'bg-(--primary) [color:var(--primary-foreground)]',
    'text-body font-medium h-10 px-5',
    'rounded-lg border-none',
    'hover:opacity-90',
    'active:translate-y-px',
  ),
  secondary: cn(
    'bg-(--muted) text-(--foreground)',
    'text-code font-medium h-8 px-3',
    'rounded-lg border border-transparent',
    'hover:bg-(--border)',
  ),
  ghost: cn(
    'bg-transparent text-(--foreground)',
    'text-code font-medium h-8 px-2',
    'rounded-lg border border-transparent',
    'hover:bg-(--muted)',
  ),
  outlined: cn(
    'bg-(--white) text-(--foreground)',
    'text-code font-medium h-8 px-3',
    'rounded-lg border border-(--border)',
    'hover:bg-(--muted)',
  ),
  destructive: cn(
    'bg-(--destructive) text-(--white)',
    'text-code font-medium h-8 px-5',
    'rounded-lg border border-transparent',
    'hover:opacity-90',
    'active:translate-y-px',
  ),
};

const sizeStyles: Record<string, string> = {
  sm: 'h-7 px-3 text-caption gap-1',
  md: 'h-8 px-5',
  lg: 'h-10 px-6 text-body',
  icon: 'h-8 w-8 p-0',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', icon, className, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center gap-1.5 font-medium transition-all duration-150 cursor-pointer shrink-0',
          'disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)/20',
          variantStyles[variant],
          sizeStyles[size as string] || '',
          className,
        )}
        {...props}
      >
        {icon && <span className="shrink-0">{icon}</span>}
        {children}
      </button>
    );
  },
);

Button.displayName = 'Button';

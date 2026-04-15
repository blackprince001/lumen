import { forwardRef, type InputHTMLAttributes } from 'react';
import { SearchNormal as Search } from 'iconsax-reactjs';
import { cn } from '@/lib/utils';

interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  onSearch?: (value: string) => void;
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ onSearch, className, ...props }, ref) => {
    return (
      <div className="relative">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] pointer-events-none"
        />
        <input
          ref={ref}
          type="text"
          className={cn(
            'w-full bg-[var(--card)] text-[var(--foreground)]',
            'text-code font-normal leading-5',
            'pl-9 pr-3 py-2 h-9',
            'rounded-lg',
            'border border-[var(--border)]',
            'placeholder:text-[var(--muted-foreground)]',
            'focus:outline-none focus:border-[var(--ring)] focus:ring-2 focus:ring-[var(--ring)]/10',
            'transition-all duration-150',
            className,
          )}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && onSearch) {
              onSearch((e.target as HTMLInputElement).value);
            }
          }}
          {...props}
        />
      </div>
    );
  },
);

SearchInput.displayName = 'SearchInput';

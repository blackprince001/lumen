import { Link } from 'react-router-dom';
import { ArrowRight2 as ChevronRight } from 'iconsax-reactjs';
import { cn } from '@/lib/utils';

export interface BreadcrumbItem {
  id: number | string;
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumb({ items, className }: BreadcrumbProps) {
  if (items.length === 0) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className={cn('flex items-center gap-1.5 text-caption text-[var(--muted-foreground)] select-none', className)}
    >
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <span
            key={item.id}
            className={cn('flex items-center gap-1.5', isLast ? 'min-w-0 flex-1 overflow-hidden' : 'shrink-0')}
          >
            {index > 0 && <ChevronRight size={12} className="opacity-40 shrink-0" />}
            {isLast ? (
              <span className="text-[var(--foreground)] font-medium truncate" title={item.label}>
                {item.label}
              </span>
            ) : item.href ? (
              <Link
                to={item.href}
                className="hover:text-[var(--foreground)] transition-colors duration-150 whitespace-nowrap"
              >
                {item.label}
              </Link>
            ) : (
              <span className="whitespace-nowrap">{item.label}</span>
            )}
          </span>
        );
      })}
    </nav>
  );
}

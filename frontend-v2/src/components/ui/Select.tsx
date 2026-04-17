import {
  Children,
  isValidElement,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type OptionHTMLAttributes,
} from 'react';
import { ArrowDown2 as ChevronDown, TickCircle as Check } from 'iconsax-reactjs';
import { cn } from '@/lib/utils';

interface SelectProps {
  value?: string | number | readonly string[];
  defaultValue?: string | number | readonly string[];
  disabled?: boolean;
  required?: boolean;
  name?: string;
  id?: string;
  className?: string;
  children?: ReactNode;
  error?: boolean;
  placeholder?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  onChange?: (event: { target: { value: string } }) => void;
}

type OptionNodeProps = OptionHTMLAttributes<HTMLOptionElement> & { children?: ReactNode };

interface SelectItem {
  value: string;
  label: ReactNode;
  disabled?: boolean;
}

function collectItems(children: ReactNode): SelectItem[] {
  const items: SelectItem[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement<OptionNodeProps>(child)) return;
    const { value, children: label, disabled } = child.props;
    if (value === undefined) return;
    items.push({ value: String(value), label, disabled });
  });
  return items;
}

export function Select({
  error,
  className,
  children,
  value,
  defaultValue,
  disabled,
  onChange,
  placeholder,
  name,
  id,
  required,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [triggerWidth, setTriggerWidth] = useState<number | null>(null);

  const items = collectItems(children);
  const current = value !== undefined ? String(value) : defaultValue !== undefined ? String(defaultValue) : '';
  const selected = items.find((it) => it.value === current);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        !triggerRef.current?.contains(e.target as Node) &&
        !contentRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  useEffect(() => {
    if (open && triggerRef.current) {
      setTriggerWidth(triggerRef.current.offsetWidth);
    }
  }, [open]);

  const choose = (v: string) => {
    setOpen(false);
    if (v !== current) {
      onChange?.({ target: { value: v } });
    }
  };

  const displayLabel = selected
    ? selected.label
    : placeholder
    ? <span className="text-[var(--muted-foreground)]">{placeholder}</span>
    : items[0]?.label ?? null;

  return (
    <div className="relative inline-flex w-full">
      <button
        ref={triggerRef}
        type="button"
        id={id}
        name={name}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-required={required || undefined}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'w-full inline-flex items-center justify-between gap-2',
          'bg-[var(--card)] text-[var(--foreground)]',
          'text-code font-normal leading-5',
          'pl-3 pr-2.5 h-9',
          'rounded-lg border border-[var(--border)]',
          'hover:bg-[var(--muted)]',
          'focus:outline-none focus:border-[var(--ring)] focus:ring-2 focus:ring-[var(--ring)]/10',
          'disabled:opacity-40 disabled:cursor-not-allowed',
          'transition-colors duration-150 cursor-pointer',
          error && 'border-[var(--destructive)]',
          className,
        )}
      >
        <span className="truncate text-left">{displayLabel}</span>
        <ChevronDown
          size={14}
          className={cn(
            'shrink-0 text-[var(--muted-foreground)] transition-transform duration-150',
            open && 'rotate-180',
          )}
        />
      </button>

      {open && (
        <div
          ref={contentRef}
          role="listbox"
          style={triggerWidth ? { minWidth: triggerWidth } : undefined}
          className={cn(
            'absolute z-50 top-full left-0 mt-1.5',
            'bg-[var(--popover)] border border-[var(--border)] rounded-lg',
            'shadow-elevated p-1',
            'max-h-64 overflow-y-auto',
            'animate-in fade-in-0 zoom-in-95 duration-100',
          )}
        >
          {items.length === 0 ? (
            <div className="px-2.5 py-1.5 text-code text-[var(--muted-foreground)]">No options</div>
          ) : (
            items.map((it) => {
              const active = it.value === current;
              return (
                <button
                  key={it.value}
                  type="button"
                  role="option"
                  aria-selected={active}
                  disabled={it.disabled}
                  onClick={() => choose(it.value)}
                  className={cn(
                    'w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md text-left',
                    'text-code text-[var(--foreground)]',
                    'hover:bg-[var(--muted)] transition-colors duration-100',
                    'disabled:opacity-40 disabled:cursor-not-allowed',
                    active && 'bg-[var(--muted)] font-medium',
                  )}
                >
                  <span className="truncate">{it.label || <span className="text-[var(--muted-foreground)]">(empty)</span>}</span>
                  {active && <Check size={12} className="shrink-0 text-[var(--foreground)]" />}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

Select.displayName = 'Select';

import { useEffect, useRef, type ReactNode } from 'react';
import { CloseCircle as X } from 'iconsax-reactjs';
import { cn } from '@/lib/utils';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
  /** Max width class, defaults to max-w-md */
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizeClass = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-2xl' };

export function Dialog({ open, onClose, title, description, children, className, size = 'md' }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  // Sync open state with native dialog
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  // Forward native ESC / cancel to onClose
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onCancel = (e: Event) => { e.preventDefault(); onClose(); };
    el.addEventListener('cancel', onCancel);
    return () => el.removeEventListener('cancel', onCancel);
  }, [onClose]);

  return (
    <dialog
      ref={ref}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className={cn(
        'w-full bg-[var(--white)] border border-[var(--border)] rounded-card shadow-modal',
        'fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 p-0 flex flex-col',
        sizeClass[size],
        className,
      )}
    >
      {/* Header */}
      {(title || description) && (
        <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-4 border-b border-[var(--border)]">
          <div className="flex flex-col gap-0.5">
            {title && <p className="text-body font-semibold text-[var(--foreground)]">{title}</p>}
            {description && <p className="text-caption text-[var(--muted-foreground)]">{description}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 p-0.5 rounded-interactive text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* Body */}
      <div className="p-5">{children}</div>
    </dialog>
  );
}

/** Convenience row for dialog footer actions */
export function DialogFooter({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-center justify-end gap-2 px-5 pb-5', className)}>
      {children}
    </div>
  );
}

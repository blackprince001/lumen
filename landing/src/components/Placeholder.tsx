import { Image } from 'iconsax-reactjs';
import { cn } from '@/lib/utils';

interface PlaceholderProps {
  /** Short label naming the screenshot to drop in here. */
  label: string;
  /** Optional second line with more detail about the shot. */
  hint?: string;
  className?: string;
  /** Visual theme of the dashed frame. */
  tone?: 'light' | 'dark' | 'mint';
  /** When set, renders this screenshot instead of the dashed placeholder. */
  src?: string;
  /** How the screenshot fills its frame. Default 'contain'. */
  fit?: 'cover' | 'contain';
  /** Vertical alignment for cover fit. */
  position?: 'top' | 'center';
}

/**
 * Renders a real product screenshot when `src` is provided, otherwise a labeled
 * dashed placeholder. The label/hint describe which part of Lumen belongs here.
 */
export function Placeholder({
  label,
  hint,
  className,
  tone = 'light',
  src,
  fit = 'contain',
  position = 'top',
}: PlaceholderProps) {
  const tones = {
    light:
      'border-forest/15 bg-[repeating-linear-gradient(135deg,transparent,transparent_10px,rgba(35,41,39,0.025)_10px,rgba(35,41,39,0.025)_20px)] text-forest/60',
    dark: 'border-white/15 bg-white/[0.03] text-white/55',
    mint: 'border-deep-forest/20 bg-deep-forest/[0.04] text-deep-forest/70',
  } as const;

  if (src) {
    // Cover mode fills a fixed-height frame (used sparingly). Default keeps the
    // screenshot at its natural aspect ratio so nothing looks cropped or stretched.
    if (fit === 'cover') {
      return (
        <div className={cn('overflow-hidden rounded-2xl', className)}>
          <img
            src={src}
            alt={label}
            loading="lazy"
            className={cn(
              'size-full object-cover',
              position === 'top' ? 'object-top' : 'object-center'
            )}
          />
        </div>
      );
    }
    return (
      <img
        src={src}
        alt={label}
        loading="lazy"
        className={cn('block h-auto w-full rounded-2xl', className)}
      />
    );
  }

  return (
    <div
      role="img"
      aria-label={`Screenshot placeholder: ${label}`}
      className={cn(
        'flex min-h-[220px] w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-8 text-center',
        tones[tone],
        className
      )}
    >
      <span className="flex size-11 items-center justify-center rounded-xl bg-current/10">
        <Image size={22} variant="Bulk" />
      </span>
      <div className="space-y-1">
        <p className="text-sm font-semibold uppercase tracking-wide">{label}</p>
        {hint && <p className="max-w-xs text-xs leading-relaxed opacity-80">{hint}</p>}
      </div>
    </div>
  );
}

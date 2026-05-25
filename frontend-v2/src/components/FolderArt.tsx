import { useId } from 'react';
import type { PaperTheme } from '@/lib/paper-themes';
import { cn } from '@/lib/utils';

interface FolderArtProps {
  theme: PaperTheme;
  hasItems: boolean;
  /** How many paper sheets to peek out (0–3). Caller decides from papers.length. */
  peekCount?: number;
  className?: string;
}

/**
 * Chunky illustrative folder. Pure visual — caller handles layout, hover, click.
 * Closed when `hasItems` is false; with peeking paper sheets otherwise.
 * Colors come from the passed theme so the look matches paper cards.
 */
export function FolderArt({ theme, hasItems, peekCount = 0, className }: FolderArtProps) {
  const uid = useId().replace(/[^a-zA-Z0-9-_]/g, '-');
  const gFront = `front-${uid}`;
  const gBack = `back-${uid}`;
  const gPaper = `paper-${uid}`;
  const shadow = `shadow-${uid}`;

  const peeks = Math.max(0, Math.min(3, hasItems ? peekCount || 1 : 0));

  return (
    <svg
      viewBox="0 0 200 170"
      className={cn('w-full h-auto select-none', className)}
      aria-hidden
    >
      <defs>
        <linearGradient id={gBack} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={theme.accent} />
          <stop offset="100%" stopColor={theme.action} />
        </linearGradient>
        <linearGradient id={gFront} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={theme.action} />
          <stop offset="100%" stopColor={theme.border} />
        </linearGradient>
        <linearGradient id={gPaper} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#f1f3f5" />
        </linearGradient>
        <filter id={shadow} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1.5" stdDeviation="2" floodOpacity="0.18" />
        </filter>
      </defs>

      {/* Back panel with the tab */}
      <path
        d="
          M 14 32
          Q 14 22 24 22
          H 78
          Q 86 22 90 30
          L 96 40
          H 178
          Q 188 40 188 50
          V 142
          Q 188 152 178 152
          H 22
          Q 12 152 12 142
          Z
        "
        fill={`url(#${gBack})`}
        stroke={theme.border}
        strokeWidth="0.75"
      />

      {/* Peeking paper sheets (rendered behind the front flap) */}
      {peeks >= 1 && (
        <g filter={`url(#${shadow})`}>
          {peeks >= 3 && (
            <rect
              x="38"
              y="46"
              width="118"
              height="56"
              rx="6"
              fill={`url(#${gPaper})`}
              transform="rotate(-4 97 74)"
              stroke="#e5e7eb"
              strokeWidth="0.5"
            />
          )}
          {peeks >= 2 && (
            <rect
              x="42"
              y="50"
              width="116"
              height="58"
              rx="6"
              fill={`url(#${gPaper})`}
              transform="rotate(3 100 79)"
              stroke="#e5e7eb"
              strokeWidth="0.5"
            />
          )}
          <rect
            x="40"
            y="54"
            width="120"
            height="60"
            rx="6"
            fill={`url(#${gPaper})`}
            transform="rotate(-1 100 84)"
            stroke="#e5e7eb"
            strokeWidth="0.5"
          />
        </g>
      )}

      {/* Front flap */}
      <path
        d="
          M 14 64
          Q 14 56 22 56
          H 178
          Q 186 56 186 64
          V 142
          Q 186 152 176 152
          H 24
          Q 14 152 14 142
          Z
        "
        fill={`url(#${gFront})`}
        stroke={theme.border}
        strokeWidth="0.75"
      />

      {/* Subtle inner highlight band on the front face */}
      <rect
        x="22"
        y="68"
        width="156"
        height="58"
        rx="4"
        fill={theme.accent}
        opacity="0.32"
      />

      {/* Two faint guideline strokes near the base */}
      <line
        x1="28"
        y1="138"
        x2="172"
        y2="138"
        stroke={theme.border}
        strokeWidth="0.75"
        opacity="0.55"
      />
      <line
        x1="28"
        y1="143"
        x2="172"
        y2="143"
        stroke={theme.border}
        strokeWidth="0.75"
        opacity="0.4"
      />
    </svg>
  );
}

import type { ThemeName } from '@/lib/paper-themes';

/** highlight_type → paper-theme palette, shared by overlay rects and cards. */
const HIGHLIGHT_THEMES: Record<string, ThemeName> = {
  method: 'blue',
  result: 'green',
  conclusion: 'slate',
  key_contribution: 'sand',
  explain: 'olive',
  why: 'terracotta',
  define: 'sage',
};

export const HIGHLIGHT_TYPE_LABELS: Record<string, string> = {
  method: 'Method',
  result: 'Result',
  conclusion: 'Conclusion',
  key_contribution: 'Key contribution',
  explain: 'Explanation',
  why: 'Why it matters',
  define: 'Definition',
};

export function highlightTheme(highlightType: string | undefined): ThemeName {
  return HIGHLIGHT_THEMES[highlightType ?? ''] ?? 'sand';
}

export function highlightLabel(highlightType: string | undefined): string {
  return HIGHLIGHT_TYPE_LABELS[highlightType ?? ''] ?? 'Note';
}

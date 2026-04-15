/**
 * Paper Theme Utility
 *
 * Centralizes the logic for assigning consistent colored themes to papers
 * based on their ID. Maps to CSS variables defined in index.css.
 */

export const THEME_NAMES = ['olive', 'beige', 'blue', 'yellow', 'pink', 'green', 'purple'] as const;
export type ThemeName = typeof THEME_NAMES[number];

export interface PaperTheme {
  name: ThemeName;
  bg: string;
  border: string;
  text: string;
  accent: string;  // For tags/pills
  action: string;  // For buttons/interactive elements
}

export function getPaperTheme(id: string | number): PaperTheme {
  const hash = String(id).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const name = THEME_NAMES[hash % THEME_NAMES.length];
  
  return {
    name,
    bg: `var(--theme-${name}-bg)`,
    border: `var(--theme-${name}-border)`,
    text: `var(--theme-${name}-text)`,
    accent: `var(--theme-${name}-accent)`,
    action: `var(--theme-${name}-action)`,
  };
}

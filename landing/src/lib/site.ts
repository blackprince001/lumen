export const APP_URL = import.meta.env.VITE_APP_URL ?? '#';

export const NAV_LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'How it works', href: '#how-it-works' },
  { label: 'AI providers', href: '#providers' },
  { label: 'Self-hosting', href: '#self-hosting' },
] as const;

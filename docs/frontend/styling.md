---
type: Reference
title: Frontend Styling — Tailwind v4
description: Tailwind v4 via CSS-based @theme config (no JS config) — near-monochrome + forest-green palette, 8 per-paper themes, dark mode, self-hosted Inter, sonner theming, PWA theme color.
resource: frontend-v2/src/index.css
tags: [frontend, styling, tailwind, design-tokens, dark-mode]
timestamp: 2026-06-28T00:00:00Z
---

# Setup

Tailwind v4 (`tailwindcss@^4.3.0`) via the **`@tailwindcss/vite`** plugin
(`vite.config.ts:4,10`) + `tw-animate-css` for animations. **No
`tailwind.config.js` / `postcss.config.js`** — config is entirely CSS-based
(Tailwind v4 model). shadcn `components.json` declares `style: "new-york-v4"`,
`cssVariables: true`, base color neutral, `css: "src/index.css"`, ui alias
`@/components/shadcn`.

# CSS entry — `src/index.css` (676 lines)

- `@import 'tailwindcss';` + `@import 'tw-animate-css';` (`:1-2`).
- Self-hosted **Inter variable font** (`@font-face` InterVariable + italic, `/fonts/*.woff2`, `:5-19`); `@custom-variant dark (&:is(.dark *))` (`:21`).
- **Design tokens in `@theme {}`** (`:23-190`): type scale (`--text-micro … --text-display`), semantic color aliases, radii (`--radius-badge/button/interactive/banner/card/pill`), custom spacing (`--spacing-13/15/18/4_5`), layout widths (`--width-sidebar`, `--width-content-max: 72.5rem`), shadows, named animations.
- `html { font-size: 110% }` (`:201`); body Inter opsz 32 + tabular-nums + ligatures (`:493-510`).

# Base palette (`:root`, `:223-364`) — "Papers Design System", Logically-inspired

Near-monochrome + forest-green:

- Primary: `--forest-black: #232927`, `--true-black: #080908`, `--deep-forest: #0f3322`.
- Accents: `--mint-green: #4cffa9`, `--sky-blue: #3c91e6`, `--coral-red: #e45b3c`.
- Neutral scale: `--near-black/charcoal/dark-gray/mid-gray/cool-gray`, surfaces `--off-white: #fdfdfd`, `--light-gray`, `--border-gray: #e2e4e3`, `--card-surface: #f9f9f9`.
- Semantic Tailwind mappings (`:300-319`): `--primary: var(--forest-black)`, `--background: var(--off-white)`, `--foreground: var(--charcoal)`, `--border`, `--ring: var(--forest-black)`.
- Floating-panel tokens (`--panel-surface`, `--panel-radius`, `--panel-gap`) used by the 3-column workspace.

# 8 paper themes (`:321-361`)

Per-paper color identity: `--theme-olive/beige/blue/green/terracotta/sage/slate/sand-{bg,border,text,accent,action}`.
Assigned deterministically by paper id in `lib/paper-themes.ts:20` and reused
for highlight colors (`reader/highlight-colors.ts`).

# Dark theme (`.dark`, `:366-472`)

Clean neutral blacks (no tinting); inverts the neutral scale and paper-theme
vars; `color-scheme: dark`. Dark reading pulses `[data-reader-dark]` and the
CSS `filter: invert(1) hue-rotate(180deg)` applies only to `.react-pdf__Page
canvas` (`:674`) — see [pdf-reader.md](pdf-reader.md).

# Component layers

In-house `src/components/ui/*` (Logically tokens) **and** shadcn
`src/components/shadcn/*` (Radix-based) — both share the same CSS variables.

# Misc styling

Hidden scrollbars (`:487-491`); custom native `<dialog>` backdrops
(`:568-580`); sonner toasts themed via CSS vars (`:582-661`). PWA theme color
`#232927` (forest black) — `vite.config.ts:18`, `index.html:9`.
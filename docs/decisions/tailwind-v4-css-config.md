---
type: ADR
title: Tailwind v4 CSS-based config (no tailwind.config.js)
description: Tailwind v4 config lives entirely in CSS via @theme; no tailwind.config.js or postcss.config.js. Design tokens are first-class CSS variables shared by both component layers.
tags: [adr, frontend, styling, tailwind]
timestamp: 2026-06-28T00:00:00Z
---

# Decision

Frontend styling uses Tailwind v4 with the `@tailwindcss/vite` plugin and a
**CSS-based** config: design tokens are declared in `@theme {}` and CSS
variables in `src/index.css`. There is **no** `tailwind.config.js` or
`postcss.config.js`.

# Why

- Tailwind v4's recommended model is CSS-first; tokens as CSS variables are
  usable from plain CSS and arbitrary JS alike.
- Lets the in-house `components/ui/*` and the shadcn `components/shadcn/*`
  share the exact same variables (semantic color aliases, radii, spacing).
- Dark mode and the 8 per-paper themes are just CSS-variable overrides
  (`.dark {…}`, `--theme-*`), no JS config reload.

# Tradeoffs

- + No JS config to drift; tokens are single-source-of-truth in CSS.
- + `@custom-variant dark` toggle is pure CSS.
- − Tooling/editor Tailwind intellisense may need the CSS model enabled.
- − Some shadcn generators assume a `tailwind.config.js`; `components.json`
  targets `new-york-v4` with `cssVariables: true` to stay compatible.

# Alternatives considered

- Tailwind v3 JS config — rejected: v4 is the project's chosen version and
  CSS config is its idiom.
- CSS-in-JS theme tokens — rejected; tokens should be static + diffable.

# Citations

[1] [`frontend-v2/src/index.css`](/frontend/styling.md) — `@theme {}` + `:root`/`.dark` tokens.
[2] [`frontend-v2/vite.config.ts:4,10`](/frontend/build-config.md) — `@tailwindcss/vite` plugin.
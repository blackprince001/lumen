# Landing — marketing site ("lumen-landing")

A standalone React/Vite marketing app, **fully separate from the main
`frontend-v2/` SPA**. No router, no shared code at import level.

# Concepts

* [Landing app](app.md) - 9 stacked sections, the only link to the main app is the `VITE_APP_URL` env var driving CTAs.

# Quick facts

- Name `lumen-landing` v0.1.0 (private) — `landing/package.json`.
- React 19.2 + Vite 7.2 + Tailwind v4 (`@tailwindcss/vite`), Radix UI, lucide-react, iconsax-reactjs, motion (Framer Motion v12). **No `react-router-dom`.**
- Path alias `@ → ./src` (`landing/vite.config.ts:8-11`); bun package manager.
- HTML title: "Lumen — The home your papers and references deserve".
- **Not deployed via docker-compose** (no service in either compose file). Its `dist/` is built by Vite/bun and presumably served elsewhere.
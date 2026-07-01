---
type: Config
title: Frontend Build & Config
description: Vite 7 + PWA plugin, strict TypeScript, ESLint flat config, env vars, bun/npm package managers, pdfjs postinstall copy.
resource: frontend-v2/vite.config.ts
tags: [frontend, build, vite, typescript, eslint, pwa]
timestamp: 2026-06-28T00:00:00Z
---

# `vite.config.ts` (`:7-53`)

- Plugins: `@vitejs/plugin-react`, `@tailwindcss/vite`, `VitePWA` (`:8-33`).
- **PWA** (`vite-plugin-pwa`): `registerType: 'autoUpdate'`, manifest name "Lumen", `theme_color: #232927`, `background_color: #FDFDFD`, standalone display, icons `pwa-192/512`; Workbox caches `**/*.{js,css,html,woff2,png,svg}` up to 5MB, `navigateFallbackDenylist: [/^\/api\//]` so API calls bypass the SPA fallback (`:28-32`).
- Path alias `@ → ./src` (`:36-38`).
- `worker: { format: 'es' }` — required by the xlsx viewer's parser worker under code-splitting (`:40-43`).
- Dev server `0.0.0.0:5173`; preview `0.0.0.0:4173` with `allowedHosts: true` (`:44-52`).

# TypeScript — `tsconfig.app.json`

`target: ES2022`, `module: ESNext`, `moduleResolution: bundler`,
`jsx: react-jsx`, **strict** + `noUnusedLocals/Parameters` +
`noFallthroughCasesInSwitch` + `noUncheckedSideEffectImports` +
`erasableSyntaxOnly` + `verbatimModuleSyntax`, path alias `@/* → ./src/*`
(`tsconfig.app.json:2-33`). Root `tsconfig.json` references app + node
configs. Build = `tsc -b && vite build` (`package.json:8`).

# ESLint — `eslint.config.js`

Flat config: `@eslint/js` + `typescript-eslint` recommended +
`eslint-plugin-react-hooks` + `eslint-plugin-react-refresh` (vite), browser
globals, ignores `dist` (`:8-23`).

# Env

`.env.example`: `VITE_API_URL=http://localhost:8000/api/v1`,
`VITE_GOOGLE_CLIENT_ID=` (baked at build time; typically passed as Docker
build args — see [/infra/docker.md](/infra/docker.md)).

# Package manager

`bun.lock` present (Bun) alongside `package-lock.json` (npm). `postinstall`
runs `copy-pdfjs` to stage cmaps + standard fonts into `public/pdfjs/`
(`package.json:11-12`) — consumed by the reader self-host setup in
[pdf-reader.md](pdf-reader.md).

# Lint/typecheck

- `bun run lint` (or `npm run lint`) — ESLint.
- Build = `bun run build` ran `tsc -b` (typecheck) + `vite build`.
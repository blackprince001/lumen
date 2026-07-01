# CLAUDE.md

## Codebase Index (OKF v0.1)

This project has a living `docs/` folder organized as an **Open Knowledge
Format (OKF) v0.1** bundle — a directory tree of markdown concept files with
YAML frontmatter (required `type` field), `index.md` directory listings for
progressive disclosure, and `log.md` update history.

### OKF in one breath

- Every non-reserved `.md` file under `docs/` is a **concept** with YAML
  frontmatter. The only **required** frontmatter field is `type`.
- Reserved filenames: `index.md` (directory listing, no frontmatter except the
  bundle root which declares `okf_version`) and `log.md` (dated update log,
  newest first).
- Cross-links are standard markdown links. **Bundle-relative absolute links**
  start with `/` (e.g. `/backend/api/chat.md`); relative links are also allowed.
  Broken links are tolerated (treated as not-yet-written knowledge).
- Conventional body headings: `# Schema`, `# Examples`, `# Citations`.
- Consumers MUST tolerate unknown `type` values, missing optional fields, and
  unknown extra frontmatter keys.

### Session Start

- Read `docs/index.md` first, then `docs/architecture.md` for the system map.
  These contain the project map — do NOT re-scan the codebase from scratch.
- For a subsystem, open its directory `index.md` to see what concepts exist
  before opening individual documents.

### ⚠️ Red Flags — Don't Do These

Before searching the codebase, ask: **"Is this information in the docs already?"**

DON'T:
- Use Glob/Grep to explore or understand project structure.
- Run broad file searches to learn how things work.
- Search the codebase when a concept doc already explains it.
- Invoke the codebase-indexer skill unless you are maintaining the docs after
  a change.

DO:
- Start every session reading `docs/index.md` and `docs/architecture.md`.
- Use targeted Glob/Grep ONLY to find specific files (e.g. you know the
  filename pattern) or to verify a detail, not to learn the architecture.
- Consult `docs/log.md` for recent changes.
- Update the docs after every feature/bugfix so future sessions can use them.

### Subagents

Subagents spawned via the Task/Agent tool (Explore, Plan, general-purpose) do
**not** inherit `CLAUDE.md` — they start blank. When writing any subagent
prompt, include this line at the top:

> This project has an OKF knowledge bundle under `docs/`. Read `docs/index.md`
> and `docs/architecture.md` first — they are the project map. For a subsystem,
> read its directory `index.md`. Do not explore source files for information
> already covered there.

### After Every Feature or Bugfix

1. Run `git diff HEAD~1 --name-only` to identify changed files.
2. Re-scan only the changed files and their direct neighbors (same
   package/directory).
3. Update the relevant concept docs using targeted edits (do not rewrite
   unaffected sections). OKF update rules:
   - New module/package → add a concept file (with frontmatter `type:`) and
     list it in the parent directory's `index.md`.
   - New class/function/endpoint → update the relevant concept's body.
   - Renamed files/folders → update cross-links across the bundle and the
     parent `index.md`.
   - New dependency → update the relevant concept and `docs/architecture.md`.
   - New naming/code pattern → update the concept that documents it.
4. **Ask:** "Did this change make or reverse an architectural decision?"
   - If yes → add a new concept of `type: ADR` under `docs/decisions/` and
     list it in `docs/decisions/index.md`.
   - If no → skip.
5. Append a dated entry to the relevant `log.md` (root `docs/log.md`, or a
   scoped one) newest-first under an ISO 8601 `YYYY-MM-DD` heading:
   ```
   ## 2026-06-28
   * **Update**: <what changed> — affected <concept links>.
   ```
6. If you add or rename a concept, also update its parent `index.md` entry.

### OKF conformance quick-check

- Every non-reserved `.md` file has parseable YAML frontmatter delimited by `---`.
- Every frontmatter block has a non-empty `type`.
- Reserved files (`index.md`, `log.md`) follow §6/§7 of the OKF spec when present.
- Don't reject bundles over missing optional fields, unknown types, extra
  keys, or broken cross-links — the consumption model is permissive.
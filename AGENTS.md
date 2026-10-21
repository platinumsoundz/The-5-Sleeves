# AGENTS.md — Session Bootstrap (read FIRST, every time)

This project keeps long-term memory in `memory/`. **Any AI agent or new
developer session must read `memory/00-index.md` first**, then follow
`memory/01-session-protocol.md` without exception.

## The five rules that matter most

1. **Read memory before code.** Start at `memory/00-index.md`.
2. **One system per build** — build one system, add regression coverage, and
   update memory before starting the next. The owner currently wants several
   builds accumulated before verification: until they explicitly request a
   batch, do not run tests or ask them to run tests. Keep unverified changes
   uncommitted; resume verification/commit when the owner requests the batch.
3. **Plug-and-play modules only** (`memory/03-module-architecture.md`). New
   features are small files dropped into `server/modules/` or
   `public/src/modules/`; the master scans them at boot. Target < 150 lines
   per file, one job, novice-friendly. Never edit the master to add a
   feature.
4. **Canon is law** (`memory/02-universe-canon.md`, sources in `lore/`).
   Don't invent lore; raise conflicts.
5. **Save state after every build.** Update `memory/05-work-state.md` and
   `public/project-memory.json` so an interrupted session can resume from
   memory alone.

## Quick reference

- `PROJECT_INDEX.md` — compact map from features to owning code and focused tests.
- `npm test` — owner has deferred execution until they request a combined batch; do not prompt them to run it before then.
- `npm start` / `npm run dev` — run the server (port 3000).
- `npm run sprites` — regenerate baked pixel art.
- `ROADMAP.md` — build plan and status markers.
- Past failures and how to avoid them: `memory/01-session-protocol.md`
  ("Lessons learned").

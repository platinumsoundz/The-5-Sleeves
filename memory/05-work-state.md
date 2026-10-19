# Memory — Chapter 05: Work State

**Resume point.** Read this to know exactly where the last session stopped.
Update it after every build (protocol rule 9).

Last updated: 2026-10-19 (foundation chapter split).

## Git state

- Branch `main`, tracking `origin/main` (github.com/platinumsoundz/The-5-Sleeves).
- Was 14 commits ahead of origin at the time of writing; **push regularly**.
- Commit style: imperative summary line + bullet body explaining the system.

## Done (committed)

- Roadmap 1–8: camera/minimap, interpolation, sprite pipeline, baked
  background, six abilities + statuses, Rust Wardens, domination,
  progression (XP curve, levels, skill points).
- Universe canon committed to `lore/` (bible v2.0 + 75-chapter outline) and
  wired into `public/project-memory.json`.
- Memory split into chapters (this directory) + `AGENTS.md` bootstrap.
- Corruption fixes after an interrupted session: stray git tmp objects
  removed; `world.js` invalid seed `0x5leeves` → `0x51ee5`; suite green
  (38/38).

## In progress

- **Archive terminals (#10) — DONE** (server module + client module +
  interact key F/Y/touch READ button, lore log panel). Committed through
  8b04151.
- **Combat juice (#11) — DONE** (combat-juice client module).
- **Zones (#9) — DONE**: one simulation per canon book (`server/sim/`);
  zones isolate players, broadcasts, wardens, echoes and matches. Zone
  travel (`zone:switch` + `zoneChanged` hook) exists server-side; only the
  title-screen picker has UI for now.

## Session build queue (this session, in order)

1. ✅ Foundation: memory chapters, AGENTS.md, module-architecture spec.
2. ✅ Server module loader + terminals migrated
   (`server/hook-bus.js`, `server/module-loader.js`,
   `server/modules/archive-terminals.js`, commit 479f70c).
3. ✅ Client module system + #10 terminals + #11 combat juice +
   boot priority + loading screen (commit 8b04151).
4. ✅ #9 zones/rooms — per-zone simulation (`server/sim/`), canon
   five-book zone catalog, lobby + title-screen zone picker, zone travel.
5. ✅ #13 fixed-timestep loop (`FIXED_DT_MS`) with decoupled snapshot
   broadcast (`BROADCAST_MS`); host runs whole steps with a catch-up cap.
6. ✅ #14 spectate + replay — `server/modules/spectate-replay.js` (rolling
   60 s per-zone buffer, `GET /api/replay/:zoneId`, `spectate:join`),
   `replay-viewer` client module, `?spectate=` / `?replay=` URL modes.
7. ✅ Canon check (zone ↔ book mapping verified; new terminal lore marked
   PROPOSED for owner review) + `ROADMAP-FUTURE.md` brainstorm draft.

## What is left / next session

- Roadmap items 1–14 are COMPLETE. No build is in flight.
- **Push to origin** is still pending owner confirmation.
- Next work is owner-directed: brainstorm `ROADMAP-FUTURE.md`, approve or
  rewrite the proposed terminal lore, then pick the next system (suggested
  order: in-game zone switcher → private rooms → auth → PWA → store).
- In-game zone switching currently has no UI (server event exists only);
  the title-screen picker is the only player-facing zone choice.
7. Canon polish + draft the future roadmap for brainstorming (includes
   the owner's product asks: monetization, email logins, Android/PC +
   console/iOS — see `07-product-direction.md`).

## How to resume after an interruption

1. `git fsck` (delete unreferenced `.tmp_obj_*` junk if any).
2. `npm test` — must be green; if not, fix before anything else.
3. Read `05-work-state.md` (here) → continue at the first unchecked queue
   item.

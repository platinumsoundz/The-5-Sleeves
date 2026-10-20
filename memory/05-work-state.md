# Memory — Chapter 05: Work State

**Resume point.** Read this to know exactly where the last session stopped.
Update it after every build (protocol rule 9).

Last updated: 2026-10-20 (step 12 Adventure Hub).

## Step 12 — Adventure Hub, portals and expanded MENU (DONE)

- **Welcome + HUD** — the persistent welcome text is gone; a 3 s toast greets
  the operative instead. The connection pill only shows while connecting or
  offline, so the radar is pinned to the top-left corner. Game-mode and tower
  status sit directly beneath it; HP/level/Conduit Pulse live compactly in
  the top-centre. The default camera is wider (VIEW_TARGET 940×620).
- **Safe hub** — canon-zone spawns sit inside a 112-radius no-combat bubble
  around the Cipher Core. Attacks/abilities are rejected inside, damage to
  occupants is blocked, wardens ignore them, and respawns return there.
- **Physical hub NPCs** — Quartermaster Vale opens the shop; the PvP and
  co-op arena gates travel to instanced `arena-pvp` / `arena-pve`
  simulations. Co-op sets `friendlyFire: false`; party members are always
  immune to each other. Arenas stay out of the title-screen lobby.
- **Exploration** — three regional towers unlock by presence, pay 60 XP and
  push the fogline back; radar/map show dormant vs online state.
- **Expanded MENU** — Character, Skill Tree, Inventory, Party & Friends,
  Inbox, Map and Settings (SFX toggle, remappable keys, Exit to Title).
  Chat names open Add Friend / Invite to Party / Send Gift.
- Ledger bumped to `2.4.0`; suite green (56/56, including `test/hub.test.js`
  safe-zone, NPC, tower and friendly-fire coverage).

## Step 11 — mobile HUD redesign (DONE)

- **Collapsible chat** — chat starts collapsed as a CHAT button in the
  top-right block; unread badge counts messages while closed; Enter opens,
  Escape closes. Tabs/input unchanged.
- **HUD realignment** — radar/minimap moved to the top-left slot (below
  status); HP, core %, points, ability cooldown, level/XP moved to the
  top-right `#hud-slot` beneath SPECS / CHAT / SFX. Kill feed sits under
  that block; domination standings under the radar.
- **360° analog joystick** — the 4-way D-pad is gone; a touch-drag stick
  (bottom-left) returns a full-angle vector with a dead zone. Keyboard,
  gamepad, action buttons and networking untouched.
- Ledger bumped to `2.3.0`; suite green (54/54, incl. new analog-stick
  maths tests in `test/input.test.js`).

## Git state

- Branch `main`, tracking `origin/main` (github.com/platinumsoundz/The-5-Sleeves).
- **2026-10-20 incident:** a cleanup of `.l2s.tmp_obj_*` files (PRoot
  hardlink backing data) destroyed every loose git object. The working tree
  survived; the repo was rebuilt from `origin/main` (2886785) plus the
  intact worktree as commit `2d976f5` ("Restore full game after local git
  object-store loss"). **All content is present, but the granular history of
  roadmap builds 0–6 is gone.** Do NOT delete files inside `.git/objects`.
- 2 commits ahead of origin after the rebuild; **push regularly** and push
  soon so a local loss cannot repeat this.
- Commit style: imperative summary line + bullet body explaining the system.
- `npm test` runs test files serially (`--test-concurrency=1`). Parallel
  servers oversubscribe this device and make warden/respawn tests flake;
  serial runs take about a minute and are reliable.

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

- Step 12 (Adventure Hub, physical portals, expanded MENU, chat actions) is
  COMPLETE and covered by `test/hub.test.js`. No build is in flight.
- Roadmap items 1–14 are COMPLETE; step 12 was an owner-directed extension.
- **Recovery note:** the commit history for those builds was reconstructed
  as one commit (`2d976f5`) after the object-store incident. Future builds
  start clean from there.
- **Push to origin** is still pending owner confirmation — do this first
  next session; the local repo has now lost history once.
- Next work is owner-directed: brainstorm `ROADMAP-FUTURE.md`, approve or
  rewrite the proposed terminal lore, then pick the next system (suggested
  order: in-game zone switcher → private rooms → auth → PWA → store).
- In-game zone switching is exposed through the hub portals (and the server
  `zone:switch` event); there is still no free-roam zone list in the MENU.
  The title-screen picker remains the only direct canon-zone choice.
7. Canon polish + draft the future roadmap for brainstorming (includes
   the owner's product asks: monetization, email logins, Android/PC +
   console/iOS — see `07-product-direction.md`).

## How to resume after an interruption

1. `git fsck` (delete unreferenced `.tmp_obj_*` junk if any).
2. `npm test` — must be green; if not, fix before anything else.
3. Read `05-work-state.md` (here) → continue at the first unchecked queue
   item.

# Memory — Chapter 05: Work State

**Resume point.** Read this to know exactly where the last session stopped.
Update it after every build (protocol rule 9).

Last updated: 2026-10-20 (step 13 village-scale world rebuild + test isolation).

## Step 13b — Test isolation and stable gate tests (DONE)

- **Scratch profiles** — `server.js` now honours a `PROFILE_FILE` env override.
  Every test server spawns with `PROFILE_FILE` pointing at
  `tools/profile-scratch.js`'s per-process temp file, wiped on import, so a
  test run never reads or writes `player-profiles.json`. Operatives start at
  35 credits / full HP every time.
- **Unique names** — remaining fixed test names (`HubTester`, `ArenaOne/Two`)
  now carry a `Date.now()` suffix, matching the rest of the suite.
- **Gate-hold retries** — `test/zones.test.js` repeats the edge nudge up to
  four times instead of exactly twice, so a loaded device that coalesces
  `player:move` packets cannot miss the 320 ms gate hold. Timeout raised to
  10 s for the same reason.
- Suite is green and repeatable: **60/60 across three consecutive runs**
  (~70 s each). The 540 legacy test profiles already inside the gitignored
  `player-profiles.json` were left alone (they can no longer affect tests).

## Step 13 — Village-scale world, cities, towers, credits (DONE)

- **World chain** — `haven-perimeter` → `wild-perimeter` → `haven-coast`
  (Tower 1) → `wild-coast` → `haven-scorched` (Tower 2) → `wild-scorched` →
  `haven-frozen` (Tower 3) → `wild-frozen` → `haven-apex` (Tower 4) →
  `wild-apex` → `haven-citadel` (Tower 5). Walking into an edge gate moves
  zones after a short deliberate hold; the destination entry point matches the
  road used.
- **Six safe cities** — every haven is a full 1000×700 no-combat cube with a
  merchant and an Arena Master on the left. Reaching a city unlocks it as a
  spawn point and sets `homeCity`; city east roads stay gated until that
  city's tower is cleared.
- **Five towers** — north of Coast through Spire. Each tower runs three
  scaled Rust Warden waves, pays credits + XP + a skill point, marks
  `player.towers[index]`, broadcasts `tower:cleared`, and opens the east road.
- **Six arena instances** — PvP and PvE each offer domination, team
  deathmatch and tower capture (`arena-pvp`, `arena-pvp-tdm`,
  `arena-pvp-tower`, `arena-pve`, `arena-pve-tdm`, `arena-pve-tower`).
  PvP arrivals auto-balance red/blue teams; PvE is one co-op faction with
  friendly fire off. Arena and tower deaths return the operative to
  `homeCity`.
- **Money + loot** — credits start at 35, drop from kills, and pay for
  merchant gear. Loot rolls by enemy tier; merchants buy back at 50%.
  Equipped weapons/armour contribute `gearAtk`, added to projectile damage
  without changing base combat maths.
- **Map + fast travel** — `world:map` lists eleven overworld rooms and five
  towers; the MENU Map page draws the route and fast-travels to unlocked
  cities. Arenas stay private.
- **Compatibility** — bare `player:join` (tests/dev tools) still lands in
  `wild-perimeter`; the real client starts in `haven-perimeter`.
- Ledger bumped to `2.5.0`; suite green (60/60, including new world/tower
  coverage in `test/world.test.js`).

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
- Local history has the restored baseline plus Steps 12–13; **push is still
  pending**. `git push origin main` fails in this environment with
  "could not read Username for 'https://github.com'" — no credential helper
  data, no `gh`, no token in the env. The owner must supply a PAT (or run the
  push from a machine with credentials). Check `git status` /
  `git log origin/main..HEAD` rather than trusting an old ahead-count; local
  `main` is 4 commits ahead of `origin/main`.
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

- None. Step 13 (village-scale world rebuild) is COMPLETE and green; it is
  committed in the same build as the test-isolation fix. Only the push to
  origin is outstanding (owner confirmation).

## What is left / next session

- **Push to origin** is blocked on credentials (no PAT/gh in this
  environment). Ask the owner for a token or push from their machine; 4 local
  commits are waiting (`Building the village-scale world…` is the newest).
- Next work is owner-directed: playtest the new city → tower → road loop,
  tune enemy scaling/credit prices, approve or rewrite proposed terminal lore,
  then pick the next system (suggested: private rooms → auth → PWA → store).
- The title screen intentionally offers only the First Village; every other
  city is unlocked by walking the chain or fast-travelling from the MENU map.

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

- Step 12 (Adventure Hub) and Step 13 (village-scale world) are COMPLETE;
  no build is in flight.
- Roadmap items 1–14 are COMPLETE; steps 12–13 were owner-directed extensions.
- **Recovery note:** the commit history for earlier builds was reconstructed
  as one commit (`2d976f5`) after the object-store incident. Future builds
  start clean from there.
- **Push to origin** is still pending owner confirmation — do this first
  next session; the local repo has lost history once.

## How to resume after an interruption

1. `git fsck` (delete unreferenced `.tmp_obj_*` junk if any).
2. `npm test` — must be green; if not, fix before anything else.
3. Read `05-work-state.md` (here) → continue at the first unchecked queue
   item.

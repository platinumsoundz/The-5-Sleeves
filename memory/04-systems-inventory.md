# Memory — Chapter 04: Systems Inventory

What exists TODAY. Check here before building anything new.
(Updated after every build — if a system is listed here, it is committed
and tested.)

## Server core (`server.js`, ~1130 lines, global state)

- **Lobby & join flow** — name validation, unique names, profile load on
  join, `join:accepted` with stats, `server:welcome` with world + core.
- **Combat** — server-authoritative projectiles with swept-path collision
  (no tunneling), shield mitigation (40% while shielded), burn/slow/haste
  statuses, downed + timed respawn (5 s) with kill credit,
  `combat:hit/down/respawn/kill` events.
- **Six signature abilities** (`Q`): Conduit Pulse (cipher), Gale Push
  (wind), Tide Snare (water), Ember Lance (fire), Bulwark wall (earth),
  Void Siphon (dark). Server-resolved, per-ability cooldowns, destructible
  walls that block projectiles.
- **Rust Wardens (PvE)** — patrol/wander, aggro ring (330), chase, hostile
  fire; 9 s respawn; pay XP + skill point + core charge; `MAX_WARDENS` env.
- **Domination** — West/East/South relays, uncontested capture (more bodies
  = faster), mixed factions freeze it, held relay scores 1 pt/s, capture XP,
  first-to-400 (`SCORE_LIMIT` env) match banner + reset.
- **Progression** — single `applyXp` funnel; curve in
  `server/progression.js` (`xpForLevel`, `levelFromXp`, cap 40); level-up =
  skill point + 10 max HP + broadcast; `XP_SCALE` env; persisted.
- **Parties** — squads up to 4, click-to-invite, shared party XP for nearby
  members, squad chat channel.
- **Chat** — global / squad / faction, control-char filtered, 240-char cap.
- **Archive Echoes** — up to 5 random lore pickups, respawn every 7 s, pay
  skill point + core charge + XP.
- **Persistence** — `player-profiles.json`: name, domain, stats, skill
  points, XP/level, core charge/points. Atomic tmp+rename saves, periodic
  (10 s) + on-event flushes. Modules extend the record via the `persist`
  hook.
- **Tick loop** — single `setInterval(50 ms)`; dt capped at 100 ms.
- **Plug-and-play module system** — `server/hook-bus.js` +
  `server/module-loader.js` auto-scan `server/modules/*.js` at boot with a
  shared context (hooks: joining/joined/left/persist/tick; plus
  registerSocket, route, distance, applyXp, persistPlayer, xpScale). Broken
  modules are skipped, never fatal.

## Server modules (`server/modules/`)

- **archive-terminals** — 3 canon-lore terminals (Transit Manifest,
  Observatory Console, Sealed Vault Interface), radius-based interact,
  40 XP + 12 core charge once per operative, `terminalsRead` persisted via
  the persist hook. Client interaction UI still pending (roadmap #10).

## Client core (`public/client.js` + `public/src/`, 13 modules)

- **camera.js** — follow, look-ahead, auto/scroll/key zoom, shake hook,
  viewport culling, minimap.
- **interpolation.js** — ~100 ms behind-blend for remote players and
  projectiles, capped extrapolation.
- **renderer.js** — baked offscreen background, sprite sheets with walk
  frames, procedural fallback; draws players, wardens, projectiles,
  effects, bursts, relays, echoes, fog, HUD chrome, minimap; emits the
  three module hooks (`render:world`, `render:fx`, `render:overlay`).
- **netcode.js** — every socket event in one place.
- **plugin-host.js** — client hook bus (DOM-free, Node-importable).
- **module-runner.js** — fetches `/api/client-modules`, parallel import,
  priority-ordered setup with loading-screen progress callbacks.
- **uiManager.js** — title/join + boot-status line, character menu
  (upgrades + domain select), HUD hints per input mode, party widget +
  minimap, chat, toasts.
- **inputManager.js** — keyboard (WASD/arrows, Space attack, Shift dash,
  E shield, Q ability, **F interact**, C specs, +/- zoom), touch d-pad +
  action buttons (incl. READ), gamepad (Y/triangle = interact) with
  dynamic HUD hints.
- **world.js** — deterministic ruin props, named landmarks, terminal
  helpers (pure, Node-testable).
- **assetLoader.js / characterRenderer.js** — baked PNG sheets with
  procedural fallback; per-domain idle + 4-frame walk.
- **audioManager.js** — Web Audio SFX, mute toggle.
- **config.js** — world/core/colour constants.

## Zones (`server/zones-catalog.js` + `server/sim/`)

- **zones-catalog.js** — the five canon zones (one per book), each with
  name, book, spirit/domain, tint and its own lore terminals:
  `the-perimeter` (Wind), `sunken-coast` (Water), `scorched-wastes`
  (Earth), `frozen-wastes` (Fire), `apex-citadel` (Cipher).
- **sim/state.js** — `createSimulation(catalogZone, host)`: all per-zone
  state (players, wardens, projectiles, effects, bursts, echoes,
  objectives, faction scores, match) plus a zone-scoped `send()` and
  `broadcast()` (empty rooms skip broadcasts).
- **sim/spec.js** — every shared tuning number (warden stats, XP bounties,
  respawn delays, sleeve colours, archive log lines, env knobs).
- **sim/combat.js** — damage/shield mitigation, deaths, respawns, status
  effects, knockback, swept-path collision maths.
- **sim/abilities.js** — the six domain abilities and Ember Lance blasts.
- **sim/wardens.js** — warden spawning, patrol/chase AI, shots, respawn.
- **sim/objectives.js** — per-zone domination relays, capture, match end.
- **sim/projectiles.js** — projectile stepping, wall absorption, hits.
- **sim/echoes.js** — Archive Echo spawn/collect.
- **sim/index.js** — `stepZone(sim, now, dt)`: one full zone tick.
- **server.js** — now host only: lobby (`zones:lobby`), zone registry,
  zone travel (`zone:switch` + `zoneChanged` hook), squads, chat,
  profiles/progression, module loader.
- **Fixed timestep (#13)** — the host accumulates real time and runs whole
  `FIXED_DT_MS` simulation slices (default 50 ms, max 5 catch-up steps
  before resyncing); zone snapshots are broadcast separately every
  `BROADCAST_MS` (default 50 ms). Both are env knobs.

## Server modules (`server/modules/`, auto-discovered)

- **archive-terminals** (priority 50) — readable lore terminals per zone;
  first-read XP + core bounty, persisted per operative.
- **spectate-replay** (priority 70) — rolling 60 s snapshot buffer per
  active zone (`GET /api/replay/:zoneId`) and observer sockets
  (`spectate:join`) that watch a zone without joining its roster.

## Client modules (`public/src/modules/`, auto-discovered)

- **world-decor** (priority 20) — ruin props + landmark name labels.
- **zone-atmosphere** (priority 30) — per-zone colour wash + arrival
  banner using the zone meta from `join:accepted`.
- **terminals** (priority 40) — terminal beacons, READ prompt (F / Y /
  touch), lore log panel with first-read bounty state. Roadmap #10 done.
- **combat-juice** (priority 60) — hit sparks, floating damage numbers,
  afterimages, proximity screenshake. Roadmap #11 done.
- **replay-viewer** (priority 10) — observer director camera for
  `?spectate=<zone>` and rolling-buffer playback for
  `?replay=1&zone=<zone>`.

## Tooling & tests

- `npm start` / `npm run dev` (watch) / `npm test` (node --test) /
  `npm run sprites` (bake art via `tools/generate-sprites.js`).
- `tools/png.js` — dependency-free PNG writer + supersampled rasteriser.
- 18 suites: server boot/health, server modules, zones, fixed timestep,
  spectate/replay, abilities, wardens, objectives, progression, camera,
  interpolation, renderer, sprites, module import resolution, client
  module contract. 50 tests, all green.

## Planned this session (ROADMAP items, not built yet)

- (none — roadmap 1–14 complete; next is canon polish + the future
  roadmap brainstorm)
- Spectate + replay = #14.

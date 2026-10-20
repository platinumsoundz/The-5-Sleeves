# Memory — Chapter 04: Systems Inventory

What exists TODAY. Check here before building anything new.
(Updated after every build — unverified work is marked explicitly; only call
it committed and tested after running the full suite.)

## Server core (`server.js`, ~1130 lines, global state)

- **Lobby & join flow** — name validation, unique names, profile load on
  join, `join:accepted` with stats, `server:welcome` with world + core.
- **Combat** — server-authoritative projectiles with swept-path collision
  (no tunneling), shield mitigation (40% while shielded), burn/slow/haste
  statuses, downed + timed respawn (5 s) with kill credit,
  `combat:hit/down/respawn/kill` events.
- **Five playable signature abilities** (`Q`): Gale Push (wind), Tide Snare
  (water), Ember Lance (fire), Bulwark wall (earth), Void Siphon (dark).
  Server-resolved, per-ability cooldowns, destructible walls that block
  projectiles; Cipher is an allied AI, not a player faction.
- **Rust Wardens (PvE)** — patrol/wander, aggro ring (330), chase, hostile
  fire; 9 s respawn; pay XP + skill point + core charge; `MAX_WARDENS` env.
  Owner requested a tougher-but-fair rise in patrol density and tower wave
  counts/stats by region; the difficulty pass is a separate pending build.
- **Domination** — three relays (one central tower in tower-capture),
  uncontested capture (more bodies = faster), mixed factions freeze it, held
  relay scores 1 pt/s, capture XP, per-arena score limits and match reset.
  PvE counts co-op, PvP counts red/blue; team deathmatch scores kills instead.
- **Progression** — single `applyXp` funnel; explicit curve in
  `server/progression.js` (120 XP base, +60 per level; `xpForLevel`,
  `levelFromXp`, cap 40); level-up =
  skill point + 10 max HP + broadcast; `XP_SCALE` env; persisted.
- **Parties** — squads up to 4, click-to-invite (chat name menu works at any
  range), shared party XP for nearby members, squad chat channel, automatic
  party-friendly-fire immunity.
- **Chat** — global / squad / faction, control-char filtered, 240-char cap;
  clicking a chat name opens Add Friend / Invite to Party / Send Gift.
- **Archive Echoes** — up to 5 random lore pickups, respawn every 7 s, pay
  skill point + core charge + XP.
- **Persistence** — `player-profiles.json`: name, domain, stats, skill
  points, XP/level, core charge/points, credits, home city, unlocked cities,
  completed towers, inventory/equipment, friends, inbox and the persisted
  `cipherIntroSeen` first-meeting milestone. Atomic tmp+rename saves, periodic
  (10 s) + on-event flushes.
  Modules extend the record via the `persist` hook.
- **Safe cities & arenas** — each haven is a full-map safe rectangle with a
  merchant and Arena Master; attacks/abilities are rejected inside, damage
  to occupants is blocked, and wardens ignore them. Six instanced arena
  rooms cover PvP/PvE domination, team deathmatch and tower capture; PvP
  arrivals auto-balance red/blue, PvE is one co-op faction. Arena and tower
  deaths return the operative to `homeCity`.
- **Tick loop** — single `setInterval(50 ms)`; dt capped at 100 ms.
- **Plug-and-play module system** — `server/hook-bus.js` +
  `server/module-loader.js` auto-scan `server/modules/*.js` at boot with a
  shared context (hooks: joining/joined/left/persist/tick; plus
  registerSocket, route, distance, applyXp, persistPlayer, xpScale,
  secureTransport). Broken
  modules are skipped, never fatal.

## Server support files

- **account-store.js** — separate account ledger (`users.json`) with salted
  scrypt password hashes and atomic temp-file replacement; legacy named
  profiles remain separate.
- **secure-transport.js** — recognizes native secure sockets, Render's
  `the-5-sleeves.onrender.com` HTTPS proxy headers, and explicitly trusted
  reverse proxies (`TRUSTED_PROXY_TLS=true`).

- **shop-catalog.js** — merchant stock with credit prices and sell values,
  starter inventory/equipment, item lookup and tier-based loot tables.
  Salvage-only Shattered Circuitry and Corroded Relay Parts drop in the
  matching wasteland tiers, remain sellable through city merchants, and are
  excluded from merchant purchases. Equipped gear contributes `gearAtk`.
- **skill-tree.js** — server mirror of the current six-node branching skill
  tree; node costs rise with depth (tiers 1–4 cost 1–4 points), with parent
  requirements and descriptions. Owner requested a substantial five-faction
  passive/special-upgrade expansion; that separate balance build is pending.

## Server modules (`server/modules/`)

- **archive-terminals** — 3 canon-lore terminals (Transit Manifest,
  Observatory Console, Sealed Vault Interface), radius-based interact,
  40 XP + 12 core charge once per operative, `terminalsRead` persisted via
  the persist hook. Client UI lives in the terminals client module.
- **hub-services** — every city merchant (buy/sell, gear recalc), Arena
  Master menu and arena entry, inventory/equipment persistence and shop
  payloads.
- **world-services** — unlocked-city fast travel (`city:travel`) and world
  map broadcast.
- **player-customisation** — title-screen choice among five playable
  factions and the eight-colour suit palette (`player:palette`), validated
  and persisted; old Cipher profiles migrate to Wind.
- **tower-services** — three-wave tower runs, completion rewards and
  east-road unlocks; preserves a first-contact Cipher milestone and emits a
  Cipher dialogue marker after every tower clear.
- **cipher-companion-memory** — persists first contact with the allied Cipher
  AI; the client also shows a join welcome and a distinct line for every clear.
- **social-services** — friends list (mutual add/remove), persistent inbox
  with claimable attachments, and inventory gifting to online operatives.
- **sleeve-skills** — server-validated skill-node unlocks; spends skill
  points only when the parent chain is complete.

## Client core (`public/client.js` + `public/src/`, 19 modules)

- **camera.js** — follow, look-ahead, auto/scroll/key zoom, shake hook,
  viewport culling, minimap.
- **interpolation.js** — ~100 ms behind-blend for remote players and
  projectiles, capped extrapolation.
- **renderer.js** — baked offscreen background per biome, sprite sheets with
  walk frames, procedural fallback; draws players, wardens, projectiles,
  effects, bursts, relays, echoes, safe-city rectangles, tower rooms and a
  receding fogline, compact top-centre HUD (credits + zone), top-left
  radar/mode strip and tower-run status; the compact top card omits health,
  a 3 px XP line sits at the viewport top, and alerts stack beneath the left
  minimap/score strip; emits the three module hooks
  (`render:world`, `render:fx`, `render:overlay`).
- **biomes.js** — biome metadata + procedural ground painters for grass,
  water, scorched earth, frost-and-ember, wind, cipher and arena; wasteland
  reuses the baked ruin tiles. Zone backgrounds are cached per biome + world
  size in renderer.js; the live simulation now preserves each catalog biome.
  Most regions have procedural backgrounds rather than dedicated PNGs.
- **netcode.js** — every socket event in one place, including hub state,
  world map, tower runs, arena menu, fast travel, shop, friends/inbox/gifts,
  skill unlocks and arena zone changes.
- **plugin-host.js** — client hook bus (DOM-free, Node-importable).
- **module-runner.js** — fetches `/api/client-modules`, parallel import,
  priority-ordered setup with loading-screen progress callbacks.
- **controllerNavigation.js** — shared gamepad button map, focus navigation,
  topmost modal detection and gameplay input lock.
- **uiManager.js** — title/join + boot-status line, MENU coordinator
  (seven pages), shop + arena panels, welcome/toast lifecycle, controller-
  accurate HUD hints, Escape/B-button back handling for dialogs and menus,
  party widget + minimap, collapsible chat and chat-name action popup.
- **menu.js / menu-pages.js** — menu navigation plus Character, Skill Tree,
  Inventory, Party & Friends, Inbox, Map and Settings renderers.
- **keybinds.js** — remappable combat/menu action keys with localStorage
  persistence and readable key labels.
- **inputManager.js** — keyboard, unchanged touch joysticks/action buttons,
  gamepad movement and D-pad/left-stick focus navigation. Controller bindings:
  A interact/confirm, RT blast, B dash/back, Y shield, X/RB Sleeve ability;
  Start/Select opens or exits menus.
- **shooting.js / shootingControls.js** — Settings-persisted Auto-Aim +
  Hold-to-Fire or Twin-Stick Manual Aim; mouse, gamepad and touch aim input,
  500 ms client repeat cadence. **New implementation is unverified**; server
  remains authoritative for combat and safe-zone rules.
- **world.js** — deterministic ruin props, named landmarks, terminal
  helpers (pure, Node-testable).
- **assetLoader.js / characterRenderer.js** — baked PNG sheets with
  procedural fallback; the five playable factions have idle + 4-frame walk
  art, Rust Wardens have baked art + fallback, plus cosmetic palette overlay
  and aura.
  Tower rooms use named, region-biome-tinted procedural landmarks.
- **audioManager.js** — Web Audio SFX, mute toggle.
- **hud.js** — top-level 3 px XP progress line and a compact level/credit/
  zone/ability summary; no duplicate health bar.
- **PWA shell** — `public/manifest.json` configures standalone landscape
  launch; `index.html` includes Apple home-screen metadata. Settings exposes
  a standard Fullscreen API toggle with unsupported-browser guidance.
- **fullscreen.js** — DOM-free fullscreen API state/toggle helper; safe to
  import in Node and handles browser rejection.
- **config.js** — world/core/colour constants.

## Zones (`server/zones-catalog.js` + `server/sim/`)

- **zones-catalog.js** — six safe cities (`haven-perimeter` through
  `haven-citadel`), six wilderness areas and five tower rooms, linked by
  edge exits. Tower 5 unlocks a 3000×2100 Eastern Expanse, with five empty
  boss-site markers and five existing Rust Warden guardians. This frontier is
  proposed game content, not established comic canon. Six private arena rooms
  cover PvP/PvE × domination / TDM / tower capture. The real client starts at
  `haven-perimeter`; bare legacy joins land in `wild-perimeter` for tests.
- **sim/state.js** — `createSimulation(catalogZone, host)`: all per-zone
  state (players, wardens, projectiles, effects, bursts, echoes,
  objectives, faction scores, match, tower run, biome, custom world size and
  future boss-site markers) plus a zone-scoped
  `send()` and `broadcast()` (empty rooms skip broadcasts). Safe zones support
  both rectangles (cities) and circles.
- **sim/spec.js** — every shared tuning number (warden stats and explicit
  per-tier scaling multipliers, XP bounties,
  respawn delays, sleeve colours, archive log lines, env knobs).
- **sim/combat.js** — damage/shield mitigation, deaths, respawns, status
  effects, knockback, swept-path collision maths.
- **sim/abilities.js** — five playable domain abilities and Ember Lance blasts.
- **sim/wardens.js** — tier-scaled warden spawning, patrol/chase AI, shots,
  respawn; tower rooms spawn controlled waves through options.
- **sim/objectives.js** — domination relays, co-op/PvP team factions,
  capture, TDM score limits and match end/reset.
- **sim/projectiles.js** — projectile stepping, wall absorption, hits.
- **sim/echoes.js** — Archive Echo spawn/collect.
- **sim/index.js** — `stepZone(sim, now, dt)`: one full zone tick.
- **server.js** — now host only: lobby (`zones:lobby`), zone registry,
  edge/road travel (`zone:switch`, `city:travel`), city unlock/home-city
  respawns, squads, chat, profiles/progression, module loader.
- **Fixed timestep (#13)** — the host accumulates real time and runs whole
  `FIXED_DT_MS` simulation slices (default 50 ms, max 5 catch-up steps
  before resyncing); zone snapshots are broadcast separately every
  `BROADCAST_MS` (default 50 ms). Both are env knobs.

## Server modules (`server/modules/`, auto-discovered)

- **zone-hazards** (priority 55) — five wilderness-only telegraphed hazard
  fields with idle/warning/active cycles, server-authoritative damage and
  per-cycle hit limits; safe-zone damage protection remains authoritative.
  Matching client module draws world-space danger rings. **Implemented,
  untested.**
- **auth** (priority 5) — optional guest/register/login flow using username
  and password; rate-limited, secure-transport checked outside development,
  including Render HTTPS proxy requests, with
  server-side join guards, separate account profile keys and legacy-name
  reservation. Client join controls live in `uiManager.js`; socket calls in
  `netcode.js`. Username/password only: no email verification or reset.
  **Implemented but not yet tested.**
- **dev-console** — non-production only when explicitly enabled with
  server-configured redeem codes; code attempts are rate-limited and grant
  types are allowlisted server-side. Grants credits, skill points, items,
  skills and terminal reads through server-owned state.
- **core-meditation** — safe-haven Cipher Cores heal nearby operatives at
  3% max HP per second, capped at maximum health. The existing idle stipend
  remains: 5 credits every 5 minutes after 30 seconds of inactivity, capped
  at 20 credits per UTC day and persisted per operative.
- **archive-terminals** (priority 50) — readable lore terminals per zone;
  first-read XP + core bounty, persisted per operative.
- **hub-services** (priority 20) — city merchants, credits buy/sell, gear
  bonuses and Arena Master menus/entry.
- **world-services** (priority 25) — unlocked-city fast travel and world map.
- **tower-services** (priority 30) — three-wave tower runs, rewards and
  east-road unlocks.
- **spectate-replay** (priority 70) — rolling 60 s snapshot buffer per
  active zone (`GET /api/replay/:zoneId`) and observer sockets
  (`spectate:join`) that watch a zone without joining its roster.

## Client modules (`public/src/modules/`, auto-discovered)

- **zone-hazards** (priority 35) — draws the server-timed idle, warning and
  active danger fields in world space.
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
- **hub-world** (priority 25) — draws city merchants, Arena Masters, road
  gates, tower rooms and the nearby `F · ...` interaction prompt.
- **cipher-companion** (priority 45) — accessible hologram introduction after
  the operative's first tower clear; thanks them and offers future help.

## Tooling & tests

- `npm start` / `npm run dev` (watch) / `npm test` (node --test) /
  `npm run sprites` (bake art via `tools/generate-sprites.js`).
- `tools/png.js` — dependency-free PNG writer + supersampled rasteriser.
- Visual coverage regression suite (`test/visuals.test.js`) checks zone
  biome propagation, named tower landmarks and required baked sprite files;
  **added but unrun**.
- `test/pwa.test.js` covers standalone manifest metadata, Apple tags, and
  fullscreen enter/exit/unsupported behavior; **added but unrun**.
- `test/shooting.test.js` adds six regressions for mode persistence, aim
  normalization/selection and repeat cadence. The suite was not run; recent
  auth, hazard, visual, balance and shooting changes also remain unverified.
  Run `npm test` before treating the current tree as green.

## Planned next (owner-directed)

- Step 14 PWA/fullscreen and Step 13 HTTPS/controller/HUD changes are
  implemented but unverified; see `memory/05-work-state.md`. Run `npm test`
  and browser/device checks before marking the builds complete.
- The roadmap remains complete; future work is playtest tuning, canon
  approval and the future roadmap brainstorm.

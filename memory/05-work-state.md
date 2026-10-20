# Memory — Chapter 05: Work State

**Resume point.** Read this to know exactly where the last session stopped.
Update it after every build (protocol rule 9).

Last updated: 2026-10-20 (Cipher join welcome/every-tower dialogue and Tower 5 Eastern Expanse implemented; tests not run).

## Current session — Cipher welcome and post-Tower-5 Eastern Expanse (IMPLEMENTED, UNVERIFIED)

- Cipher's hologram dialog now welcomes each joined operative with thanks and
  the goal of becoming strong enough to unlock all towers. The first-contact
  milestone remains persisted, and a Cipher message follows every tower clear.
- The Tower 5 safe city's east exit is locked per operative until Tower 5 is
  cleared. It then leads to a new `Eastern Expanse` zone, 3000×2100, with five
  empty boss-site markers and five existing Rust Wardens placed as guardians;
  no new enemy type or boss behavior was added.
- Zone dimensions now propagate through server metadata and client zone state
  for camera/world-bound rendering. The gate is visually sealed until unlocked.
- Added `test/endgame.test.js` and extended `test/world.test.js` for dialogue,
  per-operative gate, frontier size/markers/guardians and tower-clear payload.
  The Expanse is proposed game content beyond the source comic; canon source
  documents remain unchanged.
- **Tests and browser playtesting were not run** because no shell/browser
  runner is available. Verify all five tower clears, gate unlock, large-world
  movement/camera, and guardian behavior before marking complete.

## Current session — Step 14: PWA and in-game fullscreen (IMPLEMENTED, UNVERIFIED)

- Added `public/manifest.json` with standalone display, landscape orientation,
  app names, start URL and requested colors; `index.html` now links it and
  includes Apple home-screen capability/status metadata.
- Settings has an enter/exit fullscreen button using the standard
  `documentElement.requestFullscreen()` / `document.exitFullscreen()` API,
  tracks `fullscreenchange`, and handles unsupported/rejected requests.
  Unsupported browsers are directed to Home Screen standalone mode.
- Added `public/src/fullscreen.js` and `test/pwa.test.js` for manifest metadata,
  API enter/exit and rejection behavior. Existing frame loop, canvas, touch
  input and sockets were not changed.
- **Tests/browser checks not run** because no shell/browser runner is available.
  Fullscreen API support varies by mobile browser; verify iOS and Android on
  device before claiming universal browser fullscreen behavior.

## Current session — Step 13: HTTPS, controller menus, controls and HUD (IMPLEMENTED, UNVERIFIED)

- Shared secure-transport checks now accept native HTTPS/WSS, Render's
  `the-5-sleeves.onrender.com` forwarded HTTPS, and explicitly trusted
  proxies. `server.js` passes the check to the auth module; plaintext and
  arbitrary forwarded-host headers remain blocked in production.
- Controller bindings are A=interact/confirm, RT=blast, B=dash/back,
  Y=shield, X/RB=Sleeve ability. Left stick/D-pad navigate focusable controls
  in title/menu/modal overlays; A activates, B/Escape closes the top dialog.
  Movement is suppressed while overlays are open. Touch and socket pathways
  were left intact.
- Removed the top HUD health bar, moved XP progress to a 3 px line at screen
  top, and anchored toast/banner/kill notifications below the left minimap
  and mode strip. Added visible focus styling and compact controller hints.
- Added tests in `test/auth.test.js`, `test/input.test.js`,
  `test/hud.test.js`, and `test/renderer.test.js`. **No tests or browser/
  controller playtests were run** because this workspace has no shell/browser
  runner; no commit was made. Keep the build unverified until those checks pass.

## Current session — Post-comic story, five factions, Cipher AI (IMPLEMENTED, UNVERIFIED)

- Set the game continuity after the comic, with a new operative's story in
  the aftermath. Cipher remains a character but is now a non-playable allied
  AI; the five selectable factions are Wind, Water, Earth, Fire and Dark.
  Legacy Cipher-domain profiles map to Wind.
- On each operative's first cleared tower (any tower), the server persists
  `cipherIntroSeen` and sends `cipherIntro: true`; the client companion
  module shows Cipher's thank-you/help offer with a custom hologram portrait.
- Added `server/modules/cipher-companion-memory.js`,
  `public/src/modules/cipher-companion.js`, `public/assets/cipher-companion.svg`,
  and regression coverage in `test/cipher-companion.test.js`, `test/world.test.js`,
  `test/skill-tree.test.js`, `test/customisation.test.js`, and
  `test/server-modules.test.js`.
- Updated README, game-continuity guidance and project memory. Comic source
  documents remain unchanged. **Tests and browser playtesting were not run**;
  this workspace has no shell/browser runner. No commit was made. Keep this
  build unverified until `npm test` and browser checks pass.

## Current session — Selectable firing styles (IMPLEMENTED, UNVERIFIED)

- Added a Settings toggle for persisted Auto-Aim + Hold-to-Fire and Twin-Stick
  Manual Aim. Auto-aim chooses the nearest living Warden (or opposing player
  in a PvP arena); twin-stick supports mouse, gamepad right stick, and a
  dedicated touch aim stick. Deflecting the touch aim stick fires while held.
- Fire repeats every 500 ms, above the server's existing 450 ms cooldown;
  the server still validates cadence, safe-zone rules, collisions and damage.
- Added `public/src/shooting.js`, `public/src/shootingControls.js`, and
  `test/shooting.test.js`. **Neither `npm test` nor browser playtesting could
  be run: this workspace session has no shell or browser runner.** Keep this
  build unverified until both are checked; no commit was made.

## Current session — README game overview (DONE)

- Replaced the one-line README with a project introduction covering the
  game's premise and aim, playable systems, technical architecture, local
  setup commands, and links to roadmap/canon guidance. Documentation-only;
  no game behavior changed.

## Current session — Visual asset/render wiring audit (IMPLEMENTED, UNVERIFIED)

- Confirmed baked sprites exist for all six sleeve domains (idle + walk),
  Rust Warden, and ruin tiles; character and Warden renderers have procedural
  fallbacks. All eight biome painters exist, and all catalog zones have biome
  assignments; most regional backgrounds are procedural, cached canvases.
- Fixed the missing runtime biome copy in `server/sim/state.js`; the server's
  `zoneMeta` now receives each catalog biome so the renderer and atmosphere
  use the intended regional background. Fixed tower-room landmarks displaying
  generic `TOWER` by copying each tower's configured name, and tinted tower
  structures by their regional biome.
- Added `test/visuals.test.js` for biome propagation, tower landmark names,
  and required baked sprite files. **Tests and live browser checks were not
  run** because this session has no shell/browser runner. No new PNG was
  generated: existing sprites are present and missing asset fallbacks exist.

## Current session — Wilderness zone hazards (IMPLEMENTED, UNVERIFIED)

- Added server/client modules for five timed, telegraphed hazard fields in
  the five wilderness roads. Each cycles idle → warning → active and applies
  12 damage at most once per active cycle to players in its radius.
- Hazard state is sent to players on join/zone travel; safe-zone protections
  still apply. Client draws the field warning rings in world space.
- Added `test/zone-hazards.test.js` for phase timing, damage cadence, warning
  delivery and safe-zone protection. **Tests were not run:** the user
  authorized proceeding unverified because no shell runner is available.
- This is the first gameplay slice only. The owner approved proceeding
  unverified because no shell runner is available. Do not start another
  feature build until a test-capable session runs `npm test` and fixes any
  failures.

## Owner-approved future build queue (one system per build)

After hazards are tested and stable, continue one slice at a time:

1. Warden variants.
2. Repeatable bounties.
3. Canon-aligned story events.
4. Replay controls / clip improvements.
5. Database-backed storage.
6. Observability.
7. Load testing.
8. Security hardening.
9. Accessibility.

Email verification and recovery remain deferred by owner choice. Each queued
system still needs its own build, tests and memory update.

## Current session — Optional account registration and login (IMPLEMENTED, UNVERIFIED)

- Added the auto-discovered `auth` server module, `server/account-store.js`,
  and a Settings-at-title account mode for guest/register/login. Passwords use
  Node `scrypt`; account records live separately in ignored `users.json`.
- Account profile keys are isolated from legacy guest profiles. Registration
  refuses names already used by a legacy profile; guests cannot claim
  registered usernames. Authenticated join guards bind the socket to its
  account profile. Registration/login require HTTPS outside development;
  attempts are rate-limited.
- Added `test/auth.test.js`. **No tests were run**, following the request to
  continue without testing. This is a first username/password slice, not the
  planned email verification, password reset, or account migration flow.
- Do not treat auth or earlier untested changes as verified; run the full
  suite before commit/deployment when testing is authorized.

## Current session — Developer grant codes (IMPLEMENTED, UNVERIFIED)

- Updated the Settings panel to redeem codes instead of asking for one
  developer token and a grant button. Server maps codes to a fixed allowlist
  (`credits`, `skills`, `items`, `collectibles`, `all`); clients cannot send
  arbitrary amounts or grant types.
- Enable only on a non-production server with `DEV_CONSOLE_ENABLED=true`
  and `DEV_CONSOLE_CODES` set to JSON mapping codes (minimum 8 characters)
  to allowed grant names. Codes stay server-side; comparison is timing-safe
  and failed attempts are rate-limited.
- Updated `test/dev-console.test.js` for code redemption. **No tests were run.**
  All preceding economy, balance, and meditation changes remain unverified.

## Current session — Safe-city Core meditation (IMPLEMENTED, UNVERIFIED)

- Added auto-discovered `server/modules/core-meditation.js`: players in a
  safe city's Cipher Core receive 5 credits after 30 seconds idle, then every
  5 minutes, capped at 20 credits per UTC day. Movement or combat actions
  reset the idle timer; the daily cap persists through the existing profile
  persist hooks.
- Safe-haven Core no longer pays the existing charge-to-skill-point bounty;
  the old active Core reward remains in non-haven zones. No client rendering
  or input code changed.
- Added `test/core-meditation.test.js` for timing, cap, and movement behavior.
  **Tests were not run, as requested.**
- The prior salvage economy and progression balance edits are also untested.
  Test before committing or deploying; do not treat this as verified.

## Current session — tuning transparency and tiered skill costs (IMPLEMENTED, UNVERIFIED)

- XP progression now names and exports its 120-XP base and +60-per-level
  increment; formulas are unchanged.
- Rust Warden tier multipliers now live as named values in
  `server/sim/spec.js`; `scaledStats()` uses them, preserving existing
  behavior while making tier HP/damage/speed/range/XP/credit tuning explicit.
- Skill-tree nodes now cost their depth in points (tier 1=1, tier 2=2,
  tier 3=3, tier 4=4), mirrored in the client. Validation remains server-side.
- Added regression assertions for client/server skill-cost parity and the
  current tier-3 warden output. **As requested, tests were not run.**
- This follows the salvage economy slice from the preceding assistant turn;
  both changes are unverified and must be tested before commit/release.

## Current session — sell-only wasteland salvage (IMPLEMENTED, TEST RUN REQUIRED)

- Added Shattered Circuitry (8 credits) and Corroded Relay Parts (15 credits)
  to the shared item catalog and mirrored the item display data to the client.
- Both can enter tiered warden loot, persist in inventory, and be sold at
  city merchants. The merchant purchase handler explicitly rejects salvage.
  Salvage is non-equippable in the inventory UI.
- Added `test/economy.test.js` for sell-only catalog behavior and tier loot.
- **Verification is blocked:** this session has no shell/command tool available;
  run `npm test` before considering this build complete or committing it.

## Step 17 — Player palette and first-class factions (DONE THEN; SUPERSEDED)

> Historical state: the earlier six-faction picker was superseded by the
> current post-comic five-faction migration recorded at the top of this file.

- **Factions are visible from the first screen** — the title panel now has a
  SLEEVE FACTION picker with all six domains (Cipher, Wind, Water, Fire,
  Earth, Dark), each showing its signature ability. The choice travels in the
  join payload, is validated server-side by the new
  `player-customisation` module, and sets `energyColor`/`color`/accent before
  the operative enters. It is persisted with the profile.
- **Faction meaning stays simple** — the six sleeve domains *are* the
  factions (there is still no separate `player.faction`): the choice drives
  the aura, signature ability, nameplate/objective colours and `/f` chat.
  Canon zone spirits were not touched.
- **Suit colour** — eight cosmetic palettes (Ice, Acid, Ember, Rose, Violet,
  Gold, Jade, Bone) on the CHARACTER page. `player:palette` is
  server-validated and persisted; the client draws a scarf/chest strap, belt
  and every third aura spark in the chosen colour, so it works on top of the
  baked sprite sheets and the procedural fallback.
- **Menu consistency** — changing faction or palette updates the title
  picker, menu header and open pages from the next snapshot (palette added to
  the refresh signature); the CHARACTER page labels the chooser
  `SLEEVE DOMAIN · FACTION` and explains that switching is free.
- 7 new tests in `test/customisation.test.js` (client/server palette parity,
  id/hex parsing, join faction, fallback, persist/broadcast, invalid input);
  suite green **82/82** (~62 s).

## Step 16 — Per-region biome backgrounds (DONE)

- **Zones carry a biome** — `server/zones-catalog.js` tags every zone:
  `haven-perimeter` = grass; all five wild roads = the same `wasteland`;
  `haven-coast` = water; `haven-scorched` = earth; `haven-frozen` = fire;
  `haven-apex`/`haven-citadel` = cipher; arenas = arena. `zoneMeta`,
  `worldMapPayload` and the zone-atmosphere banner all expose the biome.
- **Canon respected** — spirits and tints were left on the canon table
  (Wind, Water, Earth, Fire, Cipher + Dark); the biome is visual art only.
  So the five elemental looks are all present (grass/Wind spawn, water coast,
  earth scorched wastes, frost-and-ember Fire city, cipher Citadel) without
  rewriting lore.
- **`public/src/biomes.js`** — biome metadata plus compact deterministic tile
  painters (grass tufts, waves, rust/ash, frost with ember cracks, wind
  streaks, circuit traces, arena plate). The wasteland path still uses the
  baked `ruins_tiles.png` art with the procedural fallback.
- **Renderer** — background cache keyed by `biome + width + height`, so each
  region bakes once and swaps in one blit; the live perimeter dash is tinted
  with the biome edge colour. The arrival banner now reads
  `book · biome label`.
- 5 new tests in `test/biomes.test.js` (zone coverage, wild uniformity,
  fallback, floor/wall painting, bands); suite green **75/75** (~62 s).

## Step 15 — Menu cleanup, paperdoll and working skill tree (DONE)

- **Character page** is now an identity + statistics sheet: domain-coloured
  monogram card, level/XP bar, eight live stat chips (HP, power, plating,
  overclock, core charge, skill points, credits, lifetime XP), active sleeve
  specs and the faction/domain chooser. Gear no longer lives here.
- **Inventory page** owns equipment. A stick-figure paperdoll (inline SVG,
  domain-tinted) places HEAD/CHEST on the left, WEAPON/LEGS on the right and
  FEET below; tapping a slot filters the pack to that slot (tap again or ALL
  to clear). Cards show tier/ATK, EQUIP or EQUIPPED + UNEQUIP. Added the
  server-validated `player:unequip` socket and client action.
- **Skills page** now holds both CORE UPGRADES and the tree, with a points /
  nodes-unlocked summary and an available/unlocked/locked legend. Every node
  has a real effect: `server/skill-tree.js` exports `skillBonuses(player)`,
  applied by `abilityFor` (cooldown/radius/damage/slow/wall HP/duration) and
  the dash handler (cooldown/distance). Bastion Seal walls mend nearby
  operatives once per second in the simulation tick.
- **Stale-menu fix** — the open menu re-renders only when a relevant player
  field changes (level, points, XP, credits, stats, gear, skills, inventory
  length). Before this, `skill:update` refreshed against the pre-broadcast
  snapshot, so unlocks looked like they did nothing until the menu reopened.
- **Shop fix** — `shop:update` now reaches `ui.shopUpdate` (render only)
  instead of `showShop` (open the merchant), so equipping from the inventory
  no longer pops the shop panel.
- 5 new tests in `test/skill-tree.test.js`; suite green **70/70** (~74 s).

## Step 14 — Mobile-first HUD and menu (DONE)

- **One scale** — `:root` now defines every HUD measurement (`--radar-w/-h`,
  `--hud-w/-h`, `--joy`, `--tap`, `--tap-main`) plus safe-area variables
  derived from `env()`. Joystick, action buttons, radar, chat/party panels
  and both top corners all read those numbers, so the interface shrinks as
  one piece on phones.
- **Compact HUD** — the top-centre canvas readout moved out of `renderer.js`
  into `public/src/hud.js` (DOM-slot driven, no fixed pixel assumptions).
  Desktop gets the full 330×64 card; when the slot is under 220 px wide or
  58 px tall it switches to a compact 48 px card (LV + HP bar, credits + XP,
  thin XP strip). Radar / HUD / MENU-CHAT chips no longer overlap from
  320 px upward.
- **Menus use the screen** — under 620 px wide (or under 520 px tall) the
  MENU, shop and arena panels become full-bleed `100dvh` sheets with
  safe-area padding; heading, skill-points bar and tabs stay put while only
  the page body scrolls. Tabs wrap to two rows instead of hiding in a
  scroller, and the skill tree clamps its nodes to the panel edges.
- **Small fixes** — `#menu-button` is styled (it was an unstyled browser
  button), the unread chat badge floats over CHAT instead of widening it,
  banners shrink to fit narrow screens, the kill feed anchors under the
  MENU/CHAT block, and the mode strip has a 112 px minimum width on phones.
- 5 new tests in `test/hud.test.js`; suite green (65/65).

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
- Local history has the restored baseline plus Steps 12–17 pushed.
  `origin/main` tracks Steps 15–17 ("Clean up the menu pages and make the
  skill tree functional", "Give every region its own biome background",
  "Add player colours and faction identity") on top of `3594f89` ("Record
  the mobile UI polish push"). Verified with `git ls-remote` after pushing. (An earlier push attempt from this
  environment failed with "could not read Username for
  'https://github.com'" — the owner pushed from their side that time. The
  credential cache works now; if it fails again, a PAT or
  `gh auth login` must exist first.) `git status` should show
  `## main...origin/main` with no divergence.
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

- None. Step 17 (player palette + faction identity) is COMPLETE and green
  (82/82), committed as this build. The three owner asks in this polish pass
  (menu cleanup, per-region biomes, colour/faction identity) are now done.

## What is left / next session

- **Owner device check.** Verify portrait + landscape on a real phone: title
  faction picker, paperdoll slot filtering, skill-node taps, suit swatches,
  and the six region backgrounds (spawn grass, coast water, scorched earth,
  frozen frost-and-ember, citadel cipher, shared wilds wasteland).
- Then continue general polish: title-screen zone picker, chat/party panel
  visuals, map canvas text, and any balance feedback from playtesting.
- Playtest the city → tower → road loop; tune enemy scaling/credit prices.
- Approve or rewrite the PROPOSED terminal lore.
- Next system after polish (suggested): private rooms → auth → PWA → store.
- The title screen intentionally offers only the First Village; every other
  city is unlocked by walking the chain or fast-travelling from the MENU map.
- Steps 15–17 are pushed; keep committing and pushing each build.

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

- Steps 12–14 (hub, village-scale world, mobile UI polish) are COMPLETE; no
  build is in flight.
- Roadmap items 1–14 are COMPLETE; steps 12–14 were owner-directed extensions.
- **Recovery note:** the commit history for earlier builds was reconstructed
  as one commit (`2d976f5`) after the object-store incident. Future builds
  start clean from there.

## How to resume after an interruption

1. `git fsck` (delete unreferenced `.tmp_obj_*` junk if any).
2. `npm test` — must be green; if not, fix before anything else.
3. Read `05-work-state.md` (here) → continue at the first unchecked queue
   item.

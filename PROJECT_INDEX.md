# Project Index — fast code navigation

Use this map to jump to the owning file and focused coverage before searching
more broadly. It is a navigation aid, not a second specification: gameplay
values live in source, canon in `lore/`, and implementation status in the
roadmap/work-state files. Update this map when ownership moves or a new system
adds a primary entry point.

## Start here

| Need | Open |
|---|---|
| Session rules and mandatory reading | `AGENTS.md`, then `memory/00-index.md` and `memory/01-session-protocol.md` |
| Current in-progress work | `memory/05-work-state.md` |
| Build status / next approved work | `ROADMAP.md`, `ROADMAP-FUTURE.md` |
| Existing systems and ownership | `memory/04-systems-inventory.md` |
| Canon and story boundaries | `memory/02-universe-canon.md`, `lore/README.md` |
| Editable balance/content values | `CONTENT_EDITING_GUIDE.md` |
| This code-navigation map | `PROJECT_INDEX.md` |

## Runtime entry points

| Runtime | Owner | Responsibilities |
|---|---|---|
| Server | `server.js` | Express/Socket.IO host, profiles, zone registry, player sessions, module loader |
| Zone simulation | `server/sim/index.js`, `server/sim/state.js` | Per-zone state and fixed-step gameplay updates |
| Server features | `server/modules/*.js` | Auto-loaded services and gameplay systems; see module map below |
| Browser client | `public/client.js` | Client state, frame loop, input/network wiring, render orchestration |
| Client modules | `public/src/modules/*.js` | Auto-loaded world, combat-feedback, and UI add-ons |
| Zone/content catalog | `server/zones-catalog.js`, `server/content/` | Zone metadata, enemy IDs and content data |

## Server feature lookup

| Feature | Main files | Focused tests |
|---|---|---|
| Combat, respawn, abilities | `server/sim/combat.js`, `projectiles.js`, `abilities.js` | `test/abilities.test.js`, `test/server.test.js` |
| Enemy data, behavior and five-road cap | `server/content/enemies.js`, `server/sim/enemy-registry.js`, `wardens.js`, `spec.js`, `server.js` | `test/enemy-catalog.test.js`, `test/wardens.test.js` |
| Zone simulation / travel | `server/zones-catalog.js`, `server/sim/`, `server/modules/world-services.js` | `test/world.test.js`, `test/zones.test.js` |
| Towers and regional gates | `server/modules/tower-services.js`, `server/exit-rules.js` | `test/world.test.js`, `test/hub.test.js`, `test/endgame.test.js` |
| Safe-city merchants and arenas | `server/modules/hub-services.js`, `server/shop-catalog.js` | `test/hub.test.js`, `test/economy.test.js` |
| Credits, XP, levels | `server/sim/spec.js`, `server/progression.js`, `server.js` | `test/progression.test.js`, `test/economy.test.js` |
| Account login and profiles | `server/modules/auth.js`, `server/account-store.js`, `server.js` | `test/auth.test.js` |
| Parties, friends, gifts, inbox | `server.js`, `server/modules/social-services.js` | `test/server.test.js` |
| Skill tree / character setup | `server/skill-tree.js`, `server/modules/sleeve-skills.js`, `player-customisation.js` | `test/skill-tree.test.js`, `test/customisation.test.js` |
| Archives, lore rewards | `server/modules/archive-terminals.js`, `server/sim/echoes.js` | `test/server-modules.test.js`, `test/world.test.js` |
| Environmental hazards | `server/modules/zone-hazards.js` | `test/zone-hazards.test.js` |
| Cipher memory / tower dialogue | `server/modules/cipher-companion-memory.js`, `public/src/modules/cipher-companion.js` | `test/cipher-companion.test.js`, `test/endgame.test.js` |
| Match recording / spectating | `server/modules/spectate-replay.js` | `test/spectate.test.js` |

## Client feature lookup

| Feature | Main files | Focused tests |
|---|---|---|
| Socket events and snapshots | `public/src/netcode.js` | `test/server.test.js`, `test/world.test.js` |
| HUD, menus, and notifications | `public/src/uiManager.js`, `public/src/hud.js`, `public/index.html` | `test/hud.test.js`, `test/notification-polish.test.js` |
| World rendering / camera | `public/src/renderer.js`, `camera.js`, `biomes.js` | `test/renderer.test.js`, `test/camera.test.js`, `test/biomes.test.js` |
| Roads, tower gates, landmarks | `public/src/modules/hub-world.js`, `level-recommendation.js` | `test/recommended-level.test.js` |
| Credit-earned feed | `public/src/modules/credit-feedback.js` | `test/notification-polish.test.js` |
| Movement, touch and controller input | `public/src/inputManager.js`, `shootingControls.js`, `controllerNavigation.js` | `test/input.test.js`, `test/shooting.test.js` |
| Combat effects and enemy visuals | `public/src/modules/combat-juice.js`, `public/src/enemyRenderer.js`, `characterRenderer.js` | `test/renderer.test.js`, `test/visuals.test.js` |
| Archive and terminal panels | `public/src/modules/terminals.js`, `world-decor.js` | `test/server-modules.test.js`, `test/visuals.test.js` |
| PWA shell and install metadata | `public/sw.js`, `public/manifest.json`, `public/index.html` | `test/pwa.test.js` |
| Replay viewer | `public/src/modules/replay-viewer.js` | `test/spectate.test.js` |

## Test-file directory

Tests are named by subsystem. For broad coverage, inspect `test/`; for a focused
change, start with the file named in the feature tables above. Shared server
fixtures and scratch-profile helpers live in `tools/`.

## Quick search anchors

- Enemy cap/default population: `MAX_WILD_ENEMIES`, `MAX_WARDENS`, `MAX_DRONES`.
- Zone bands and exits: `levelBand`, `exits`, `zoneMeta`.
- Player snapshot flow: `players` in `server/sim/state.js` → `public/src/netcode.js`.
- Dynamic feature loading: `module-loader`, `module-runner`, `/api/client-modules`.
- UI notification split: `system-toast`, `archive-toast`, `showToast`.
- Current build or blockers: first **Current build** heading in `memory/05-work-state.md`.

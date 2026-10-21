# Beginner's guide to editing game content

This guide points to the current source of truth for common balance edits. You
can edit the named values below without changing movement, sockets, or the game
loop. Make one small change at a time and run `npm test` before keeping it.

## Quick map

| What you want to change | Start here | What to look for |
|---|---|---|
| Rust Warden health, speed, range, damage and rewards | `server/sim/spec.js` | `WARDEN` |
| How Warden stats rise in harder regions | `server/sim/spec.js` | `WARDEN_SCALING` |
| Number of Wardens in a normal zone | `server/sim/spec.js` | `MAX_WARDENS` (or the `MAX_WARDENS` server environment setting) |
| How enemies patrol, chase, fire, and respawn | `server/sim/wardens.js` | `updateWardens`, `spawnWarden` |
| Tower wave count, wave size, clear reward | `server/sim/spec.js`, then `server/modules/tower-services.js` | `TOWER_WAVES`, `TOWER_WAVE_SIZE`, `spawnWave`, `clearTower` |
| Weapon/armour/supply names, shop prices, ATK bonuses | `server/shop-catalog.js` | `SHOP_ITEMS` |
| Salvage values | `server/shop-catalog.js` | `SALVAGE_ITEMS` |
| What can drop by enemy tier | `server/shop-catalog.js` | `LOOT_BY_TIER` |
| XP for a specific activity and player-kill credits | `server/sim/spec.js` | `XP_*`, `CREDITS_*` |
| XP needed per level | `server/progression.js` | `XP_LEVEL_BASE`, `XP_LEVEL_INCREMENT`, `MAX_LEVEL` |
| XP reward scaling | `server.js` | `XP_SCALE` (environment setting) |
| Relay capture speed and points per second | `server/sim/objectives.js` | `OBJECTIVE_CAPTURE_RATE`, `OBJECTIVE_SCORE_RATE` |
| Match score limit and reset time | `server/sim/state.js`, `server/zones-catalog.js` | `scoreLimit`, `MATCH_RESET_DELAY` |
| Wilderness enemy danger/level by region | `server/zones-catalog.js` | each `wild-*` zone's `danger` and `levelBand` |

## Editing an existing value safely

1. Find the named value in the map above; edit that value rather than copying
   it into another file.
2. Keep IDs such as `blade-ember` and `shattered-circuitry` unchanged. Saved
   player inventories refer to item IDs, so renaming an ID can strand saved
   items.
3. For an item, preserve its current fields (`id`, `name`, `slot`, `price`,
   `tier`, `atkBonus`, `tierValue`, `desc`). Add sell-only drops to
   `SALVAGE_ITEMS`, not merchant stock. Add item IDs to `LOOT_BY_TIER` only
   when you want enemies to drop them.
4. For XP or credits, adjust the activity's named reward constant. The server
   applies XP and persists rewards; never award currency or XP in the client.
5. Run the focused tests (`test/wardens.test.js`, `test/economy.test.js`,
   `test/progression.test.js`, or the relevant world test), then run `npm test`.

## Adding enemy types: important current limitation

Rust Warden is currently the only implemented hostile AI type. Its data is
partly separated into `WARDEN`/`WARDEN_SCALING`, but its movement, targeting,
projectiles, spawn logic, and tower-wave integration are still Warden-specific
in `server/sim/wardens.js` and its callers. **Adding a row of stats alone will
not make a new enemy work.** Build a small enemy catalog and generic spawn /
behavior interface before adding multiple enemy families; keep the server
authoritative for AI, damage, XP, credits, and loot.

## Story and canon guardrails

Rust Wardens are established as dormant tower-network defence drones. Other AI
bots, guardians, new bosses, and climate/fog-changed animals or monsters should
be labelled **proposed game content** unless the source canon documents them.
The game can explore them as new content, but do not silently present them as
comic canon. Keep each enemy's region, size, behavior, rewards and drops
readable in the future content catalog.

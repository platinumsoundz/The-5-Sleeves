# The 5 Sleeves — Expansion Roadmap

Working list of the recommended expansion work. Each item lands as its own
change so it can be reviewed (and reverted) independently.

Status: `[ ]` todo · `[~]` in progress · `[x]` done

## Tier 1 — Feel (do first)
- [x] **1. Camera follow + zoom** — `public/src/camera.js`; smooth follow, look-ahead,
  deadzone-free clamping to world bounds, auto zoom that fits the viewport,
  scroll/key zoom, screen-shake hook, viewport-culled tile drawing, minimap.
- [x] **2. Client-side interpolation** — remote players and projectiles render ~100 ms
  behind, blended between snapshots (`public/src/interpolation.js`), with
  timestamp-refresh for stationary players and capped extrapolation.
- [x] **3. Sprite/art pipeline** — `tools/png.js` (dependency-free PNG writer + supersampled
  rasteriser) and `tools/generate-sprites.js` bake the procedural art into
  `public/assets/`: per-domain idle + 4-frame walk sheets, and a 6-variant
  ruined-tile sheet. `assetLoader.drawSpriteFrame()` slices sheets, and the
  character renderer picks a stride matched to speed. Procedural drawing remains
  the fallback whenever an asset is missing.
- [x] **4. Baked background** — floor and the static perimeter bands are rasterised once
  into an offscreen canvas (`buildBackground`) and blitted per frame, clipped to
  the visible region. Re-bakes a single time if the tile art loads late.

## Tier 2 — Depth
- [x] **5. Domain-unique abilities** — one signature skill per sleeve, cast with `Q`
  (or the SLEEVE button / RT), all resolved server-side with cooldowns:
  Conduit Pulse (cipher, AoE + core charge), Gale Push (wind, knockback + haste),
  Tide Snare (water, lingering damage/slow pool), Ember Lance (fire, explosive
  shot that burns), Bulwark (earth, destructible wall that eats projectiles),
  Void Siphon (dark, lifesteal drain). Added statuses (slow/haste/burn), downed
  respawns with kill credit, and `combat:hit`/`combat:down`/`combat:respawn`
  events the client consumes for feedback.
- [x] **6. PvE NPCs** — four Rust Warden drones now patrol, wander, acquire
  operatives inside their aggro ring, give chase and fire hostile shots
  (`hostile: true`, server-resolved damage). Wardens join the shared
  `damageableTargets()` list, never friendly-fire each other, are blocked by
  Bulwark walls, respawn after 9 s and pay out XP + a skill point to the killer.
  Baked `warden.png` sprite, minimap markers, kill feed and swept-path
  projectile collision (fast shots no longer tunnel through targets).
- [x] **7. Objectives & modes** — domination. Three relays (West / East / South) are
  captured by standing on them uncontested: one faction alone builds control
  (faster with more operatives), mixed factions freeze the capture, and a held
  relay scores for its faction every second. Captures pay XP to everyone of that
  faction, a first-to-400-points match ends with a broadcast banner and the tower
  resets. Client renders the capture rings, progress arcs, minimap relay rings,
  a faction scoreboard and match banners.
- [x] **8. Progression** — XP now flows through a single `applyXp` funnel
  (warden kills, player kills, relay captures, Core points, archive echoes) and
  levels up operatives: each level grants a Skill Point and +10 max HP, with a
  `level:up` broadcast. The curve lives in `server/progression.js`
  (`xpForLevel`, `levelFromXp`, capped at level 40) and is unit-tested; XP, level
  and progress persist in profiles. HUD gained a level/XP bar and the menu shows
  the current level.

## Tier 3 — World & content
- [x] **9. Multiple zones/rooms** — lobby + per-zone state instead of one global arena. (server/sim/* per-zone simulation, canon five-book zone catalog, title-screen zone picker)
- [x] **10. Environmental storytelling** — props, landmarks, interactable Archive terminals. (world-decor + terminals client modules; server module archive-terminals)
- [x] **11. Combat juice** — hit sparks, damage numbers, screenshake, kill feed, afterimages. (combat-juice client module)

## Tier 4 — Tech foundation
- [ ] **12. Rooms/lobbies** — folded into item 9.
- [x] **13. Fixed-timestep server loop** with a decoupled broadcast rate. (`FIXED_DT_MS` / `BROADCAST_MS` env knobs)
- [x] **14. Spectate + replay** — observer mode and a rolling snapshot buffer. (`?spectate=<zone>` and `?replay=1&zone=<zone>`; `GET /api/replay/:zoneId`)

## Conventions
- `npm test` runs the node test suite (`test/`).
- `npm run sprites` regenerates the procedural pixel-art assets.
- Server stays authoritative: the client only predicts its own movement.

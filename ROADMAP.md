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
  faction, and a per-mode score limit ends the match with a broadcast banner
  before the tower resets. Client renders the capture rings, progress arcs, minimap relay rings,
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
- [x] **15. Village-scale world rebuild** — six safe cities, five wilderness roads and five tower wave rooms connected by edge travel; credits, loot, merchants, tower-gated roads, region-scaled enemies, six PvP/PvE arena modes and world-map fast travel.

## Tier 4 — Tech foundation
- [ ] **12. Rooms/lobbies** — folded into item 9.
- [x] **13. Fixed-timestep server loop** with a decoupled broadcast rate. (`FIXED_DT_MS` / `BROADCAST_MS` env knobs)
- [x] **14. Spectate + replay** — observer mode and a rolling snapshot buffer. (`?spectate=<zone>` and `?replay=1&zone=<zone>`; `GET /api/replay/:zoneId`)

## Tier 5 — Owner-approved upcoming builds (NOT IMPLEMENTED)
These are design-approved backlog items, not shipped features. Keep each system
as its own tested build; see `ROADMAP-FUTURE.md` for rules and open details.

- [~] **Regional wilderness progression** — road/tower entrance labels show the
  catalog's recommended level band. The shared enemy registry now enforces a
  five-enemy cap per wild zone. Ordinary roads currently seed four Wardens and
  one Scavenger Drone; the Eastern Expanse uses its five existing guardians
  instead of extra ambient spawns. These slices are implemented but unverified.
  Still pending: expand roads and make them rewarding to revisit; centralize and
  tune novice-editable rosters, levels, scaling and tower waves. Proposed road
  roster: small; small + medium; medium; medium + large; large. New medium/large
  types and a boss remain unbuilt. Towers should be substantially harder than
  their preceding road; exact map sizes and wave counts need tuning.
- [ ] **Wilderness PvP, party rewards and death fees** — non-party players may
  fight in wilderness; parties are mutually protected. Every death charges a
  5% medical fee; PvP deaths additionally transfer 5% of the victim's credits
  to the victor (10% total loss), with the amount reported. Same-zone party
  members get full XP/rewards and individual copies of eligible drops. Respawn
  with a living party member, otherwise in a safe city. Towers stay PvE-only.
- [ ] **Tower matchmaking and repeat maintenance** — each party gets a private
  PvE tower run; solo operatives queue for 30 seconds, can start early with
  1–4 players, and can be matched together. Occasionally one already-cleared
  tower may fail; repair it by defeating stronger, party-scaled enemies. Failure
  must not revoke clears/rewards. Frequency and mixed-level scaling remain open.
- [ ] **Long-term collection progression** — players can eventually unlock all
  items, powers and skills, while equipping a limited active loadout. Exact
  loadout limits and respec rules remain open.
- [ ] **Lightweight survival/content systems** — scrap field-crafting and repair,
  useful temporary supplies, scheduled Fogline/weather shifts, and spirit-linked
  Sleeve Chip ability variants. New lore and creature content requires canon
  review; do not treat a chip as a spirit without consent.
- [ ] **Step 17 technical work** — empty-zone simulation efficiency, renderer
  entity culling, movement delta/throttling, and functional armor/boots/headgear
  stats. Do not add a self-ping to prevent Render Free sleep; it does not keep
  the instance awake.
- [~] **Accounts and durable progress** — password minimum changed to six
  characters with matching title-screen copy and regression coverage on
  `build/auth-password-minimum-six` (verification deferred; not merged).
  Still pending: reproduce the reported account login issue and move progress
  off Render Free's ephemeral filesystem after the owner selects a durable
  storage provider.
- [~] **Notification polish** — ordinary system notices now use a dedicated
  right-side safe-area toast; archive/story notices keep their blue left slot.
  The auto-discovered `credit-feedback` module detects authoritative balance
  increases and adds `+N CREDITS` to the existing XP-style HUD feed. Regression
  tests are added but unrun; browser/device checks remain pending.

## Conventions
- `npm test` runs the node test suite (`test/`).
- `npm run sprites` regenerates the procedural pixel-art assets.
- Server stays authoritative: the client only predicts its own movement.

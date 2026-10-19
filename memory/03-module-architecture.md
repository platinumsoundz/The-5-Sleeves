# Memory — Chapter 03: Module Architecture (plug-and-play)

The owner's rule: **new systems and mechanics must be simple plug-and-play
modules in a master–slave layout. The master scans for new modules at boot.
Each module is a small file a novice developer can adjust without knowing
the rest of the game.**

```
server.js                 MASTER (host) — lobby, sockets, zone registry, loader
server/module-loader.js   scans server/modules/*.js and boots each one
server/modules/*.js       SLAVES — one small file per server-side system
server/zone.js            one zone's simulation (players, AI, combat, objectives)

public/client.js          MASTER (host) — state, frame loop, hook bus
public/src/plugin-host.js tiny hook bus: registerHook / emitHook
public/src/module-runner.js  fetches /api/client-modules, import()s each slave
public/src/modules/*.js   SLAVES — one small file per client-side system
```

## Rules for every module

1. **One file = one system.** Target under 150 lines. If it grows past that,
   split it into a helper file next to it plus a thin module file.
2. **Never edit the master to add a feature.** If a module needs a new
   capability, extend the loader's context API — once — then every module
   has it.
3. **Fail soft.** A module that throws at load is logged and skipped; it
   must never crash the game server or client.
4. **No top-level side effects.** Client modules must be importable in Node
   (tests import them). Do all DOM work inside `setup(ctx)`.
5. **Small names, plain code.** Comments explain *why*. No clever tricks.
6. **Declare yourself** in the module's `name` and one-line `summary` so the
   loader log and manifest stay readable.

## Server module shape

```js
// server/modules/my-system.js
module.exports = {
  name: 'my-system',
  summary: 'One-line description.',
  priority: 50, // optional, lower boots first; use for boot-order deps
  setup(ctx) {
    // ctx.io, ctx.app
    // ctx.players(), ctx.playerSockets(), ctx.zones()
    // ctx.on('joining', (player, profile) => {})  before a player registers
    // ctx.on('joined',  (player, socket) => {})   after join:accepted
    // ctx.on('left',    (player) => {})           on disconnect
    // ctx.on('persist', (player, record) => {})   add fields to the profile save
    // ctx.on('tick',    (now, deltaSeconds) => {}) after each simulation step
    // ctx.route('get', '/api/my-thing', handler)
    // ctx.registerSocket('my:event', (player, payload, socket) => {})
    // ctx.distance(a, b), ctx.applyXp(player, amount), ctx.persistPlayer(player)
    // ctx.xpScale()
  }
};
```

## Client module shape

```js
// public/src/modules/my-system.js
export default {
  name: 'my-system',
  summary: 'One-line description.',
  priority: 50, // optional, lower boots first (world dressing 20 < UI 40 < cosmetics 60)
  setup(ctx) {
    // ctx.state                     live game state
    // ctx.on('frame', ({ canvas, context, state, time, dt }) => {})
    // ctx.on('render:world', ...)   world-space, under moving entities
    // ctx.on('render:fx', ...)      world-space, above entities
    // ctx.on('render:overlay', ...) screen-space, above the HUD
    // ctx.on('net:hit'|'net:down'|'net:respawn'|'net:kill'|'net:terminal'|'net:burst', handler)
    // ctx.on('action', (name, aim) => {})   local input actions
    // ctx.dom(cssText)              fixed-position UI layer above the game
    // ctx.bus, ctx.on, ctx.emit, ctx.audio, ctx.network, ctx.state
  }
};
```

## Boot priority & loading screen

- Both loaders accept an optional `priority` (default 50, lower boots
  first). Modules with dependencies on other modules must use a HIGHER
  number than their dependency (dependency boots first).
- The client imports all modules in parallel, then runs `setup` in
  priority order while reporting progress to the title-screen loading
  line (`#boot-status`, via `ui.setBootStatus`). A future full loading
  screen reuses the same progress callbacks.
- Suggested bands: 0–29 world/state, 30–49 gameplay-facing UI, 50–69
  feedback/cosmetics, 70+ analytics/experiments.

## Loader behaviour

- Server: scans `server/modules/` at boot, sorts by `priority` then name,
  logs each module, wraps `setup` in try/catch.
- Client: the master serves `GET /api/client-modules` (server scans
  `public/src/modules/` on every request — drop a file in, refresh, done);
  the runner `import()`s all modules in parallel, then calls `setup(ctx)`
  in priority order inside try/catch, reporting progress to the loading
  screen.
- **Tests**: `npm test` boots the server loader and asserts every client
  module file satisfies the contract (default export, name, setup,
  numeric priority, no top-level DOM).
- Render hooks: the renderer emits `render:world` (ground decor),
  `render:fx` (above entities) and `render:overlay` (above HUD) through
  the shared bus in `plugin-host.js`.

## Migration status

- ✅ archive terminals — first migrated module; the core server no longer
  contains any terminal code.
- ✅ client modules — world-decor, terminals, combat-juice all run through
  the client loader; renderer has zero feature code in its hooks.
- Legacy core (combat, wardens, objectives, parties, chat, progression)
  still lives in `server.js`/`server/zone.js`; migrate only with a reason.
  New systems are ALWAYS modules.
- `tick` fires once per zone per step: `ctx.on('tick', (zone, now, dt))`.
  Modules treat zone-scoped state (`zone.players`, `zone.send`) as the
  only truth; `ctx.players()` is the cross-zone roster.
- `ctx.zones()` returns the zone registry (`{ id: sim }`) and
  `ctx.playerZone(playerId)` the simulation a player is in. The
  `zoneChanged(player, socket)` hook fires after zone travel.

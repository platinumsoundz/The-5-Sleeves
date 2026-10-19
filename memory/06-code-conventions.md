# Memory — Chapter 06: Code Conventions

## Size and shape

- **Files under ~150 lines.** Bigger files get split: thin module file +
  helper file(s) next to it.
- **One job per file.** The filename says what the file does.
- **Plain language.** `nearestPlayer`, not `acq`. No clever one-liners that
  need a comment to decode.
- **Comments explain WHY**, not what. Especially tuning numbers.

## Style (match the existing code)

- Client: ES modules (`import`/`export`), browser + Node-importable (no DOM
  at module top level — tests import every file under `public/`).
- Server: CommonJS (`require`/`module.exports`).
- Server is authoritative: the client only predicts its own movement and
  renders; it never decides damage, rewards or match state.
- All numbers that are gameplay tuning get a named constant at the top of
  the file, with a one-line comment.

## Env knobs (server)

`PORT` · `MAX_WARDENS` · `SCORE_LIMIT` · `XP_SCALE` · `BROADCAST_MS` ·
`FIXED_DT_MS` — every knob must be `Number.isFinite`-guarded like the
existing ones.

## Events

- Server → client: `thing:verb` (`combat:hit`, `archive:terminal`,
  `objectives:captured`).
- Client → server: `player:verb` (`player:interact`) or `system:noun`
  (`party:invite:send`, `chat:send`).
- Never reuse an event name for a different payload shape; add a new one.

## Testing

- `npm test` must be green before every commit. No exceptions.
- New system = new test file in `test/`, named after the system.
- Server tests spawn `server.js` on a spare port and speak socket.io; copy
  the helpers from `test/abilities.test.js` rather than inventing new ones.
- Client-logic tests import the module in Node; keep logic pure and put DOM
  in `setup()`.

## Git

- One commit per system. Imperative subject, bullet body.
- Never commit: `node_modules/`, `player-profiles.json` churn, `.tmp` junk.
- After any interruption: `git fsck` + `npm test` before new work.

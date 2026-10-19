# Memory — Chapter 07: Product Direction

Owner-set product goals (raised 2026-10-19). These are DIRECTION, not yet
builds — each becomes a roadmap item in the future-roadmap brainstorm
(queue step 7). Do not start them without owner confirmation.

## Already built into the module system

- **Boot priority ordering** — every module (server + client) may declare
  `priority` (lower boots first, default 50); both loaders sort by it.
  See chapter 03.
- **Loading screen** — the title screen shows real boot progress
  (`#boot-status`, fed by the module runner's progress callbacks). If the
  game grows to need a full loading screen, it reuses the same callbacks —
  no architecture change.

## Planned (needs brainstorm + owner sign-off)

> The full discussion draft lives in `ROADMAP-FUTURE.md` at the repo root:
> build order suggestions, risks, and open questions for the owner. This
> chapter records the direction; the roadmap file records the options.

- **Monetization** — options to weigh together: cosmetics only (sleeve
  colors, trails, finishers — keeps canon intact), battle pass tied to
  seasons/books, name changes, server region picks. HARD RULE from canon:
  no pay-to-win — power has a cost in-universe, and selling power would
  break both game balance and the story's themes.
- **Email logins** — accounts replace the current name-only
  `player-profiles.json`. Must be a PLUG-AND-PLAY SERVER MODULE
  (`auth` module) wrapping the existing profile store, never core edits.
  Needs: email + password (hashed, e.g. argon2/scrypt), verification
  email, reset flow, rate limiting. Keep guest play as fallback.
- **Platforms** — PC + Android now (the game is already browser-based and
  touch-capable; add PWA manifest + service worker for installability),
  then iOS (PWA works; App Store build would need a wrapper like
  Capacitor), then console (gamepad input already partially wired — the
  interact/dash/shield mappings exist; console stores have their own
  review + payment rules).

## Architecture implications (when these start)

- Auth/session module must not block the module loader (async-safe).
- All purchases/entitlements resolve server-side; the client only
  displays them.
- Every platform difference lives in the input/UI modules, not in game
  logic.

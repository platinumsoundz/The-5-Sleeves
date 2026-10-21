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
- **Rewarded ads — first slice implemented, unverified (2026-10-21).**
  AdSense H5 reward breaks only, on an explicit tap: +100 credits or a 90 s
  shield overcharge in a safe city, and a 60 % revive after a tower death.
  The server issues single-use tokens and enforces minimum watch time,
  cooldowns and daily caps. Rules: never mid-combat, never automatic, never
  grant without a `viewed` result, and never let a display/banner unit
  masquerade as a reward — only rewarded inventory may compensate a player.
- **Optional accounts — first slice implemented, unverified.** The
  plug-and-play `auth` module currently supports username + password with
  salted scrypt hashes, rate limits, HTTPS enforcement outside development,
  separate account profiles and guest fallback. Still needed before calling
  accounts production-ready: email verification, password reset, recovery,
  and a deliberate legacy-profile migration/claim flow. Do not silently
  attach existing guest profiles to new accounts.
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

# The 5 Sleeves — Future Roadmap (brainstorm draft)

**Status: discussion document, not commitments.** Nothing here is scheduled or
approved. Read `memory/02-universe-canon.md` first — canon is law, and any
item below that would touch canon needs an explicit owner decision.

**Standing principles for everything below**

1. Canon is law; open mysteries are never resolved by feature content.
2. No pay-to-win. Power has a cost in-universe, and selling power would
   break both the balance and the story's themes.
3. Every new system is a small plug-and-play module (server or client);
   the master host is never edited to add a feature.
4. One system per build: build → test → commit → update memory.
5. No new dependency without a written reason.

---

## 1. Product & monetization

**Direction:** cosmetics only.

- Sleeve skins, trails, cast/finisher effects, terminal skins, nameplate
  colours, emotes ("salute", "hold the line").
- A book-themed supporter pass per season (Book I–V), purely cosmetic +
  a badge. No XP or power boosts.
- Storefront as a `store` server module + `store` client module; purchases
  and entitlements resolved server-side only.
- Optional: "Founder" one-off pack for early players.

**Needs owner input:** price points, regional pricing, refund policy,
whether a battle pass or straight store fits better, age gating.

**Not planned:** paid stat boosts, paid abilities, loot boxes with power,
pay-to-skip progression that affects combat.

## 2. Accounts & identity

**Direction:** optional email accounts, guest play stays.

- `auth` server module wrapping the existing profile store. Email +
  password with scrypt/argon2, email verification, password reset,
  session tokens, rate limiting, login attempt lockout.
- Keep `player-profiles.json` as the guest store until a database lands;
  the auth module maps account → profile.
- Later OAuth (Google/Apple/Discord) as extra providers in the same module.
- Account-level: display name changes (cosmetic, gated), deletion and
  data export.

**Needs owner input:** are accounts required for purchases only, or for
play too? Which providers? Minimum age handling (COPPA/GDPR).

**Risks:** email deliverability, secret management, password reset abuse,
support load. Do not build auth before there is a reason to hold accounts.

## 3. Platforms

**Direction:** PC + Android first, iOS next, console after.

- **PWA**: manifest + service worker for installability and instant load;
  Android TWA packaging if a Play Store listing is wanted. Caches the
  shell, never gameplay.
- **iOS**: PWA works today (touch controls already exist); App Store build
  would need a wrapper (Capacitor) and Apple's IAP rules for cosmetics.
- **Console**: gamepad input exists (attack/dash/shield/ability/interact/
  menu). Needs certification, TCRs, store rules, and a native wrapper.
- **Desktop wrapper** (Tauri/Electron) only if Steam/desktop store
  presence is wanted; the browser version stays the reference.
- Cross-progression via accounts (section 2).

**Needs owner input:** platform priority order and rough timeline, whether
cross-play with console is wanted, server regions.

## 4. Gameplay content

- **In-game zone travel UI** — `zone:switch` exists server-side; add a
  lobby screen / kiosk UI and let squads travel together.
- **Private rooms / matchmaking** (old roadmap #12) — room codes, passwords,
  lobby list, pick zone + match settings before joining.
- **Zone identity beyond tint** — per-book hazards that fit canon:
  perimeter fog, coast tide timing, waste heat vents, frozen slow zones,
  citadel shifting relays. Each a small sim module.
- **Warden variants per zone** (canon-safe reskins with different
  behaviour), plus a rare roaming elite.
- **Progression depth** — domain-specific upgrade branches, cosmetic
  unlocks at level milestones, daily bounties.
- **Social** — friends list, cross-zone squad chat, spectate-a-friend,
  shareable replay clips.
- **Replay improvements** — pause/scrub, export a clip, highlight kills.

**Needs owner input:** how much PvE vs PvP, whether zones should have
different rulesets or stay identical arenas with different dressing.

## 5. Technical scale

- Interest management is already per-zone; next step is spatial buckets
  within a busy zone.
- Persistence: SQLite/Postgres behind a `storage` module; migrations;
  nightly backups. JSON store stays the fallback.
- Observability: structured logs, per-zone tick timing, player counts,
  error reporting, a `/metrics` endpoint.
- Hardening: socket auth tokens, rate limits per event, payload size caps,
  anti-cheat review (server is authoritative already).
- Accessibility: input remapping, colourblind-safe palettes, reduced
  motion, screen-reader pass on menus, larger touch targets.
- Testing: load test with bots per zone, spectate/replay coverage,
  migration tests.

**Needs owner input:** expected concurrent players per zone (drives all
scaling decisions), budget for hosting/monitoring.

## 6. Canon & content pipeline

- **Owner review needed:** the four new zone terminal sets in
  `server/zones-catalog.js` are original flavour written to match their
  books; they are PROPOSED, never resolve an OPEN mystery, and should be
  read by the owner before being treated as canon.
- Story events per book (limited-time or permanent set-pieces) that stay
  inside the 75-chapter outline.
- A one-page canon conflict checklist for contributors (see
  `memory/02-universe-canon.md`).
- Sprite/art pass per zone once the palette is approved.

## Suggested build order (for discussion)

1. In-game zone switcher + squad travel.
2. Private rooms / lobby polish.
3. `auth` module (email) behind optional guest play.
4. PWA installability (manifest + service worker).
5. Cosmetic store skeleton (no power, no purchases live yet).
6. Persistence to a real database + observability.
7. iOS packaging exploration, then console.
8. Zone hazards / warden variants as content drops.

## Open questions for the owner

1. Monetization: straight cosmetic store, seasonal pass, or both? Price
   range?
2. Accounts: optional forever, or required for purchases/ranked?
3. Platform order and rough timeline (Android/PC now, iOS when, console?).
4. Canon approval for the new terminal flavour text.
5. Target concurrent players per zone (netcode and hosting budget).
6. Do zones stay identical arenas with different dressing, or diverge in
   rules?

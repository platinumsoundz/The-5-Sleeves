# The 5 Sleeves — Future Roadmap (brainstorm draft)

**Status: mixed planning queue.** The section marked owner-approved records
systems the owner wants designed/built; it does not mean they are implemented
or that every tuning value is settled. Other items remain brainstorms. Read
`memory/02-universe-canon.md` first — canon is law, and any item below that
touches canon needs review.

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

**Owner direction:** wilderness is PvP for non-party players, parties are
protected from one another, and tower runs are PvE-only. Regional enemy
rosters should become progressively harder. Exact level bands, densities and
map layouts are still to be designed.

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

## 7. Owner-approved gameplay design queue (IN PROGRESS; most items unimplemented)

Implement one system per build, with regression tests. Values below are owner
direction unless marked draft/open; do not present these as shipped behavior.

### Regional wilderness, enemies and tower challenge

- **Implemented slices, verification deferred:** physical road/tower entrances
  and arrival toasts show catalog level bands; the shared enemy registry caps
  each wild zone at five enemies. Ordinary roads seed four Wardens + one Drone;
  the Eastern Expanse uses its five existing guardians as its full population.
  Broader regional balancing and enemy-content work below remains unimplemented.

- Make each wilderness road larger and worth revisiting for XP and sellable
  loot, without making traversal empty or annoyingly long. No fixed crossing
  time is set; playtest on mobile and tune encounter spacing and landmarks.
- Each road has a configurable cap of **five simultaneous enemies**. Proposed
  roster by road: 1) small enemies; 2) small + medium; 3) medium; 4) medium +
  large; 5) large. Small enemies drop cheaper items; larger enemies drop better
  items. New medium and large archetypes and the boss remain unbuilt.
- Towers should be notably harder than the preceding wilderness. Escalate by
  a mix of enemy strength, enemies per wave, and wave count. A first-tower
  sketch is five small drones, then three medium Wardens, then a boss; this is
  a draft, not a locked wave script. Each tower needs clear recommended levels.
- Put beginner-editable recommended levels, regional rosters, enemy caps,
  scaling and tower wave settings in a clearly commented balance configuration
  file, with editing tips. Keep behavior/AI implementation separate from data.

### PvP, parties and death economy

- Wilderness: any non-party player may attack another; party members cannot
  damage each other. Towers are PvE-only; preserve safe-city protections.
- Every death incurs a **5% medical fee** of current credits, rounded down,
  without debt. A PvP kill additionally transfers **5% of the defeated
  player's credits to the victor**, so a PvP death costs the victim 10% total.
  Show the actual amount taken. Do not apply the PvP transfer to PvE deaths.
- Party members in the same zone receive the full XP/reward and each eligible
  member gets a copy of the drop. Respawn with a living party member, otherwise
  at a safe zone. Exact eligibility/respawn edge cases need tests.

### Tower matchmaking and recurring maintenance

- Each existing party gets a separate private PvE tower instance. Solo players
  can queue to be matched with other solo players; allow a **30-second** group
  window and a manual early start with **1–4** operatives.
- Occasionally, one previously cleared tower can fail and require a return
  trip to defeat a stronger maintenance wave. Failure must not remove tower
  unlocks or prior rewards; keep only one failure active at a time. Scale the
  repair encounter to the operative/party level. Failure frequency and mixed-
  level scaling formula remain open.
- The endgame collection goal is to reach the highest level and eventually
  unlock every item, power and skill, while equipping a limited active loadout.
  The active-slot limit and respec details remain open.

### Lightweight survival and module systems

- Scrap-based field crafting/repair and temporary supplies (for example,
  emergency shield cells or ration buffs). Avoid turning durability into a
  punitive repair tax or making salvage crafting strictly more profitable than
  selling it.
- Server-clocked weather/Fogline shifts may alter existing enemy detection or
  salvage opportunities. Keep cycles deterministic/lightweight, signaled to
  players, and avoid punishing players for being offline.
- Sleeve Chips may alter active abilities. Treat this as a proposed game
  system; preserve spirit agency/consent and check the lore before framing a
  spirit itself as an item.

### Story/canon review hold

The owner’s current working explanation is that Cipher still needs human
maintenance of the towers (including clearing vents and installing programs),
towers regulate planetary elements against natural-disaster collapse, and the
Fogline relates to towers not operating continuously. Spirits are linked to
towers and can hide in chips or networks. The player is an ordinary
smart-sleeve wearer continuing after Ajaye connected the five towers and made
their purpose known worldwide. These notes need comparison with the universe
rules; do not silently promote them to established canon. The proposed idea
that hostile drones detect/destroy technology such as Sleeves is expressly
parked for later review.

## Suggested build order (discussion; each item is its own build)

1. Select durable profile/account storage and fix account login; Render Free's
   local filesystem is ephemeral.
2. Author the novice-editable region-balance table and settle recommended
   levels, enemy caps/rosters and tower wave budgets.
3. Expand wilderness layouts and tune enemy/loot placement and revisit value.
4. Implement wilderness PvP rewards, 5% medical fees, same-zone party rewards,
   drop copies and safe/party respawns.
5. Add private tower matchmaking and rising PvE wave difficulty.
6. Add the random cleared-tower maintenance/failure loop.
7. Expand permanent progression and limited active loadouts.
8. Build field crafting, then weather/Fogline shifts, then ability-modifying
   chips as separate systems after canon review.
9. Separately address Step 17 performance, network throttling and functional
   gear stats; do not add an internal self-ping to defeat Render sleep.
10. Continue with PWA/device audits, account security, observability and
    accessibility.

## Open questions for the owner

1. Monetization: straight cosmetic store, seasonal pass, or both? Price
   range?
2. Accounts: optional forever, or required for purchases/ranked?
3. Platform order and rough timeline (Android/PC now, iOS when, console?).
4. Canon approval for the new terminal flavour text.
5. Target concurrent players per zone (netcode and hosting budget).
6. How should regional levels, encounter spacing, enemy caps and tower wave
   budgets be tuned after playtesting?


## Delivery roadmap and phase gates (owner direction, 2026-10-26)

This section turns the existing design queue into an ordered delivery plan. It
is a plan, not a claim that any feature below has shipped. Preserve the current
free-first constraint: do not buy a domain, enable paid resources, or incur
charges without explicit owner approval. Keep the existing Render URL as a
fallback. Cloudflare can complement the current setup; do not move the live
multiplayer server or change DNS until the replacement path is verified.

### Phase 1 — Reliability foundation (STARTED: read-only audit / decision gate)

**Goal:** protect player accounts and progress before adding more gameplay.

1. Map the live request path and confirm which host serves the browser shell,
   Socket.IO game server, and static GitHub/GitHack preview. Keep Render as the
   current game-server host until a tested alternative exists.
2. Choose a durable account/profile storage target that fits the free-first
   requirement. Current account records are written to `users.json` and game
   profiles to `player-profiles.json`; Render's ephemeral filesystem means
   local JSON files are not a durable production store across replacement or
   restart. Do not wire a database until the provider, credentials/secrets,
   backup/export path, and failure behavior are decided.
3. Reproduce and fix the reported account login issue; reduce the password
   minimum from 12 to 6 characters as previously requested, keeping the 128
   character maximum, salted scrypt hashes, timing-safe comparison, rate
   limiting, and secure-transport enforcement. Update visible validation copy
   and regression tests together.
4. Add a storage adapter behind the existing module boundary; preserve guest
   play and existing profile keys. Define migration/export and rollback before
   moving real player records. Never silently claim a guest profile for an
   account.
5. Verify with the owner-authorized test batch, then browser/device checks and
   a deployed smoke check. Only mark this phase complete when account login,
   profile persistence across restart/redeploy, and rollback are demonstrated.

**Phase 1 gate:** provider choice is unresolved. No paid database, Render disk,
custom domain, DNS change, or production migration is authorized by this plan.
The immediate task is to finish the read-only hosting/storage audit and present
an informed free-tier choice before implementing the adapter.

### Phase 2 — Regional balance and wilderness content

Create the novice-editable balance configuration; settle level bands, road
rosters/caps, enemy scaling and tower wave budgets. Expand road layouts and
rewarding revisits only after the first balance data is reviewed. Keep proposed
new creatures and lore-bearing content subject to the canon review rules.

### Phase 3 — Wilderness PvP and party rewards

Implement wilderness-only PvP, party immunity, rounded-down 5% medical fees,
the additional 5% PvP transfer, visible amounts, same-zone full party rewards
and eligible drop copies, and party/safe-city respawns. Towers remain PvE-only.
Cover edge cases with regression tests before verification.

### Phase 4 — Tower matchmaking and maintenance

Private tower run per party; solo matchmaking for 30 seconds with manual early
start for 1–4 players; then a separate, one-at-a-time maintenance failure loop
for a previously cleared tower. Never revoke prior clears or rewards. Keep open
frequency and mixed-level scaling as explicit tuning decisions.

### Phase 5 — Long-term progression and optional systems

Limited active loadouts while allowing long-term collection; then separate
builds for scrap crafting/repair, temporary supplies, weather/Fogline shifts,
and Sleeve Chips. Review canon and spirit consent before lore-bearing changes.

### Phase 6 — Performance, security, accessibility and platform polish

Profile empty-zone simulation and renderer culling, throttle movement updates,
review gear stats, harden socket events, add load tests and observability, then
complete PWA/device, accessibility and account-security audits. Never use a
self-ping to defeat Render Free sleep. Monetization stays cosmetic-only; no
pay-to-win.

### Phase completion rule

One system per build, regression coverage added with the change, memory and
inventory updated, then owner-authorized batch verification before code is
committed. Record test/browser/deployment status honestly; unverified code is
not shipped. Documentation-only planning updates may be committed separately.

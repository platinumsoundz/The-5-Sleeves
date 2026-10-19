# Memory — Chapter 02: Universe Canon

Full canon: `lore/The_5_Sleeves_Consolidated_Master_World_and_Canon_Bible_v2_0.txt`
and `lore/The_5_Sleeves_New_Complete_Story_Outline_75_Chapters.txt`.
Index + hard rules: `lore/README.md`. Read those before writing story
content. This chapter is the game-dev digest.

## The world in ten lines

- Near-future, **circa 2036**, ~5 years after the modern collapse (~2031).
  Recognisably contemporary: patched gear, repair culture, scarcity. Not
  generic cyberpunk.
- **Two catastrophes, distinct**: an ancient one made the towers necessary;
  the modern one came from AI/cloud dependence + tower failure.
- **Towers** are an ancient network regulating environmental systems.
  Restoring one improves local conditions — never a planetary reset.
- **Sleeves** are devices bonding humans to spirits/modules. Finite internal
  energy; host fatigue and spirit agency are separate limits.
- **Spirits are people**, not buttons. They can refuse. Consent matters.
- **Domains**: Wind, Water, Earth, Fire (elemental) + Cipher (fifth identity,
  a clone/derivative of the original AI, incomplete) + Darkness (forbidden
  26th ability, the sixth Dark spirit, created by the Kael family's failed
  extension project; it seeded the virus).
- **25 original modules** (5 per elemental domain; Cipher's allocation OPEN).
  Modules can be stolen, recovered, transferred, shared.
- **The virus** spreads through connected machines/towers. Endgame: the
  **Rebind** — five true Sleeves with willing spirit cooperation + Cipher's
  antivirus. No magic reset.
- Ajaye's green Cipher Sleeve is on **ONE arm only**. Never both, never
  mirrored.
- Power has cost. Any mechanic granting power should have a cost or limit.

## Five books = the game's five zones

The game is an arena side-story inside the canon. Zone map:

| Book | Zone id | Spirit | Note |
|---|---|---|---|
| 1 — The Perimeter and the First Tower | `the-perimeter` | Wind (Korb) | Starter zone; the ruined tower arena |
| 2 — The Sunken Coast | `sunken-coast` | Water (Ella) | Drowned city |
| 3 — Shadows of Exile | `scorched-wastes` | Earth (Oscar) | Desert, reservoir archive |
| 4 — The Frozen Wastes | `frozen-wastes` | Fire (Reegan) | Vault of the 26th ability |
| 5 — The Apex Citadel | `apex-citadel` | Cipher + Dark | Endgame; the Rebind |

## Canon-aligned game content

- **Rust Wardens** — patrolling defence drones (canon: dormant defence
  drones of the tower network).
- **Archive terminals** — readable lore stations; bounty once per operative.
  New terminal logs must match the zone's book and never resolve an OPEN
  mystery. The `sunken-coast`, `scorched-wastes`, `frozen-wastes` and
  `apex-citadel` terminal logs (in `server/zones-catalog.js`) are original
  flavour written to match their books — they are PROPOSED and need owner
  review before being treated as canon.
- **Archive Echoes** — fragments of Tower logs.
- **Domination relays** — "the tower recalibrates" framing.
- **The Core** — the tower's Cipher Conduit.

## Status labels (from the bible — do not upgrade silently)

`ESTABLISHED CANON` · `WORKING INTERPRETATION` · `PROPOSED CANON` ·
`OPEN` (never invent an answer) · `DRAFT` · `REJECTED`.

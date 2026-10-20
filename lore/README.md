# The 5 Sleeves — Universe Canon

This folder is the canonical worldbuilding reference for the game. When game
content (terminal lore, item names, abilities, characters, the renderer's
world) contradicts these files, the files win — or the conflict gets raised
with the project owner rather than silently resolved.

## Source documents

| File | What it is |
|---|---|
| `The_5_Sleeves_Consolidated_Master_World_and_Canon_Bible_v2_0.txt` | Master world & canon bible v2.0 (14 Oct 2026). Timeline, technology rules, Sleeve/host/spirit mechanics, character continuity, art locks, open mysteries. |
| `The_5_Sleeves_New_Complete_Story_Outline_75_Chapters.txt` | Complete five-book story outline: 5 books × 15 chapters = 75 chapters, plus recurring scene checklist. |

Status labels used in the bible (do not upgrade them silently):
`ESTABLISHED CANON` · `WORKING INTERPRETATION` · `PROPOSED CANON` ·
`OPEN` (undecided — do not invent an answer) · `DRAFT` (not canon until
approved) · `REJECTED` (never reuse).

## Hard rules the game code must respect

- **Setting**: near-future, circa 2036, ~5 years after the modern collapse.
  Recognisably contemporary world — scarcity, repair culture, patched gear.
  Not generic cyberpunk.
- **Canon identities**: the source comic establishes Cipher, the four
  elemental domains (Wind, Water, Earth, Fire), and the Dark spirit. Keep
  those source documents intact.
- **Game adaptation**: the post-comic game has five playable factions—Wind,
  Water, Earth, Fire, and Dark. Cipher is an allied, non-playable AI; never
  include Cipher in the faction picker or player-domain validation.
- **Game timeline**: the operative's story begins after the comic's events;
  do not retell the five-book story as the game's present-day plot.
- **Modules**: 25 original ability modules (5 per elemental domain, Cipher's
  allocation OPEN). Modules can be stolen, recovered, transferred, shared.
  A spirit is an intelligent agent with its own consent — never a button.
- **Two catastrophes are distinct**: the ancient catastrophe made the towers
  necessary; the modern collapse (~2031) came from AI/cloud dependence and
  tower-system failure. Do not merge them.
- **Towers** regulate environmental systems. Restoring one improves local
  conditions — it is never a magic planetary reset.
- **The virus** grew from the Kael family's failed secret extension project
  (target 30 abilities; stopped at the 26th, Darkness). The endgame is the
  Rebind: the five true Sleeves with *willing* spirit cooperation.
- **Ajaye's Cipher Sleeve is on ONE arm only** — never both, never mirrored.
- **Power has cost**: finite Sleeve energy, host fatigue, and spirit agency
  are three distinct factors. Charging a Sleeve does not rest a host.

## In-game continuity anchors

The game is an online arena side-story set inside this canon. Current
canon-aligned content:

- **Archive terminals** (`server.js`, `public/src/world.js`): three readable
  lore terminals — Transit Manifest, Observatory Console, Sealed Vault
  Interface — placed at landmark sites (Transit Terminus, East Parapet,
  Sealed Vault), each paying an XP/core bounty once per operative.
- **Archive Echoes**: ambient lore pickups.
- **Rust Wardens**: patrolling defence drones of the ruined tower network —
  consistent with the dormant defence drones awakened in Book One.
- **Five playable factions**: Wind, Water, Earth, Fire, Dark. Cipher joins
  as an AI ally after the operative's first tower clear.

New lore-bearing game content must be written to fit these documents and
added here. Update `public/project-memory.json` → `world_canon_version`
whenever a newer bible revision replaces the file in this folder.

# Memory — Chapter 01: Session Protocol (mandatory)

These rules were set by the project owner. Every session — human or AI —
follows them. They exist because of past failures; the "why" column is not
optional reading.

## Before writing any code

1. **Read this memory first.** Chapters 00 → 05, in order. Then read the
   files you are about to touch.
2. **Follow the canon** in `lore/` (summarised in chapter 02). Never invent
   lore facts that contradict the bible; raise conflicts instead.
3. **Check chapter 04** so you never rebuild something that already exists.

## How to build

4. **One system per build.** Build, test, commit, update memory — then start
   the next. Never leave two systems half-built.
5. **Everything is a plug-and-play module** (chapter 03). The master scans
   module folders at boot; dropping a small file in adds the feature. No
   feature may require editing the core to be added.
6. **Small files, simple code.** Target < 150 lines per file, one job per
   module, plain names, comments that explain *why*. A novice developer must
   be able to adjust any module without understanding the whole game.

## After every build (crash safety)

7. **Run `npm test`** — the suite must be green before anything else.
8. **Commit** with a message describing what the system does.
9. **Update memory**: mark the item in `05-work-state.md`, add the system to
   `04-systems-inventory.md`, note any new rule in the right chapter, and
   bump `public/project-memory.json`. If a session is interrupted, the next
   session resumes from memory alone.

## Lessons learned (do not repeat)

- **Invalid tokens kill silently.** `public/src/world.js` shipped a
  seed `0x5leeves` (not valid hex) from an interrupted edit; it broke the
  renderer import chain and 3 test suites. Always run `npm test` after ANY
  edit, even "tiny" ones.
- **NEVER delete `.git/objects/**/.l2s.tmp_obj_*` files.** In this
  environment (Android + PRoot) git's hardlink emulation stores loose
  object data in those dot-files. Deleting them destroys every loose
  commit/tree/blob and leaves the repo with `bad object HEAD`. `git fsck`
  reports them as "garbage", but they are load-bearing. Leave them alone;
  if fsck noise matters, ignore it rather than cleaning. (This happened on
  2026-10-20 and cost the local commit history; see chapter 05.)
- **Interrupted git writes leave junk.** After an interruption run
  `git fsck`. Garbage warnings about `.l2s.tmp_*` are normal here; only act
  on real corruption (`missing`, `corrupt`) and never mass-delete inside
  `.git/objects`.
- **Never trust "the tests passed earlier".** Re-run them.
- **Commit after each system**, not in batches. A lost session loses at most
  one build.

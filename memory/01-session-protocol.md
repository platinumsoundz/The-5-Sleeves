# Memory — Chapter 01: Session Protocol (mandatory)

These rules were set by the project owner. Every session — human or AI —
follows them. They exist because of past failures; the "why" column is not
optional reading.

## Active owner workflow override

The owner currently wants several roadmap builds accumulated before verification.
Until they explicitly request a batch, do not execute tests or ask them to run
tests. Keep adding regression coverage and record execution as deferred; leave
unverified changes uncommitted. This active preference overrides the normal
per-build test/commit cadence below until the owner requests batch verification.

## Before writing any code

1. **Read this memory first.** Chapters 00 → 05, in order. Then read the
   files you are about to touch.
2. **Follow the canon** in `lore/` (summarised in chapter 02). Never invent
   lore facts that contradict the bible; raise conflicts instead.
3. **Check chapter 04** so you never rebuild something that already exists.

## How to build

4. **One system per build.** Build one system, add regression coverage, and
   update memory before starting the next. Normally verify and commit each
   build; under the active owner override above, defer execution and commits
   until the owner requests the combined verification batch.
5. **Everything is a plug-and-play module** (chapter 03). The master scans
   module folders at boot; dropping a small file in adds the feature. No
   feature may require editing the core to be added.
6. **Small files, simple code.** Target < 150 lines per file, one job per
   module, plain names, comments that explain *why*. A novice developer must
   be able to adjust any module without understanding the whole game.

## After every build (crash safety)

7. Normally run `npm test` before a commit. Under the active owner override,
   mark tests deferred and do not run them or prompt the owner to run them until
   they explicitly request the batch.
8. Commit only after the owner-authorized verification batch is green; keep
   unverified accumulated changes uncommitted.
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
- **Tests must not share the real profile ledger.** Tests spawn servers that
  persist players to `player-profiles.json`; fixed player names therefore
  let credits/HP/XP leak between runs (this made `hub.test.js` fail once the
  starting-credit assertion landed). Every test spawn now passes
  `PROFILE_FILE` from `tools/profile-scratch.js`, and new tests should use a
  unique name suffix (`Name + Date.now().toString(36)`).
- **Commit after each system**, not in batches. A lost session loses at most
  one build.
- **Canvas readouts must measure their DOM slot.** The old top-centre HUD
  painted a fixed 70 px card no matter what CSS said, so shrinking the slot
  clipped the artwork. `public/src/hud.js` now derives width/height from
  `#hud-center` and switches to a compact layout for short slots; any future
  canvas overlay should do the same instead of hard-coding pixels.
- **Tune the interface from `:root` variables.** HUD/menu sizes live in
  `--radar-*`, `--hud-*`, `--joy` and `--tap*` (plus `env()` safe areas) in
  `public/index.html`. Change those few numbers rather than hunting dozens of
  scattered rules.

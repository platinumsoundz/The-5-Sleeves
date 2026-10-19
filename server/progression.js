'use strict';

// Pure progression maths, kept separate from the server so it can be tested
// without booting a socket server.
const MAX_LEVEL = 40;

// XP needed to advance out of `level` (level 1 -> 2 costs 120, then +60 each).
function xpForLevel(level) {
  const safe = Math.max(1, Math.min(MAX_LEVEL, Math.floor(level) || 1));
  return 120 + (safe - 1) * 60;
}

// Splits a cumulative XP total into a level plus progress inside that level.
function levelFromXp(xp) {
  let level = 1;
  let remaining = Math.max(0, Math.floor(Number.isFinite(xp) ? xp : 0));
  while (level < MAX_LEVEL && remaining >= xpForLevel(level)) {
    remaining -= xpForLevel(level);
    level += 1;
  }
  return { level, into: remaining, needed: xpForLevel(level) };
}

// Total cumulative XP needed to reach `level`.
function totalXpForLevel(level) {
  let total = 0;
  for (let step = 1; step < level; step += 1) total += xpForLevel(step);
  return total;
}

module.exports = { MAX_LEVEL, xpForLevel, levelFromXp, totalXpForLevel };

'use strict';

// Pure progression maths, kept separate from the server so it can be tested
// without booting a socket server.
const MAX_LEVEL = 40;
// Transparent linear curve: level 1 starts at 120 XP; each tier adds 60.
const XP_LEVEL_BASE = 120;
const XP_LEVEL_INCREMENT = 60;

// XP needed to advance out of `level`.
function xpForLevel(level) {
  const safe = Math.max(1, Math.min(MAX_LEVEL, Math.floor(level) || 1));
  return XP_LEVEL_BASE + (safe - 1) * XP_LEVEL_INCREMENT;
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

module.exports = { MAX_LEVEL, XP_LEVEL_BASE, XP_LEVEL_INCREMENT, xpForLevel, levelFromXp, totalXpForLevel };

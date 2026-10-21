import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const guide = readFileSync(new URL('../CONTENT_EDITING_GUIDE.md', import.meta.url), 'utf8');

test('beginner content guide points to enemy, item, XP, money and scoring controls', () => {
  for (const entry of [
    'server/sim/spec.js', 'WARDEN_SCALING', 'server/sim/wardens.js',
    'server/shop-catalog.js', 'LOOT_BY_TIER', 'server/progression.js',
    'server/sim/objectives.js', 'server/sim/state.js', 'server/zones-catalog.js'
  ]) assert.ok(guide.includes(entry), `guide documents ${entry}`);
});

test('guide warns that new enemies need behavior and proposed fauna is not comic canon', () => {
  assert.match(guide, /Adding enemy types: important current limitation/);
  assert.match(guide, /Adding a row of stats alone will\s+not make a new enemy work/);
  assert.match(guide, /proposed game content/);
});

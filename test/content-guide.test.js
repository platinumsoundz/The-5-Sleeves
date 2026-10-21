import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const guide = readFileSync(new URL('../CONTENT_EDITING_GUIDE.md', import.meta.url), 'utf8');

test('beginner content guide points to enemy, item, XP, money and scoring controls', () => {
  for (const entry of [
    'server/content/enemies.js', 'RUST_WARDEN.scaling',
    'server/sim/enemy-registry.js', 'server/sim/wardens.js',
    'server/shop-catalog.js', 'LOOT_BY_TIER', 'server/progression.js',
    'server/sim/objectives.js', 'server/sim/state.js', 'server/zones-catalog.js'
  ]) assert.ok(guide.includes(entry), `guide documents ${entry}`);
});

test('guide warns that new enemies need behavior and proposed fauna is not comic canon', () => {
  assert.match(guide, /Adding enemy types: important current limitation/);
  assert.match(guide, /Adding only a catalog row does not create a new behavior/);
  assert.match(guide, /proposed game content/);
});

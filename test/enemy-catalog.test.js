import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { ENEMY_CATALOG, RUST_WARDEN } = require('../server/content/enemies.js');
const { spawnEnemy, updateEnemies, BEHAVIORS } = require('../server/sim/enemy-registry.js');
const { scaledStats } = require('../server/sim/wardens.js');
const { WARDEN } = require('../server/sim/spec.js');

test('enemy catalog preserves the existing Rust Warden stats and tier curve', () => {
  assert.equal(ENEMY_CATALOG['rust-warden'], RUST_WARDEN);
  assert.equal(RUST_WARDEN.size, 'medium');
  assert.equal(RUST_WARDEN.stats.hp, 90);
  assert.equal(RUST_WARDEN.stats.xp, 12);
  assert.equal(RUST_WARDEN.stats.credits, 14);
  assert.equal(WARDEN.hp, RUST_WARDEN.stats.hp, 'legacy imports keep working');
  assert.equal(scaledStats(3).hp, 140);
  assert.equal(scaledStats(3).credits, 29);
});

test('generic enemy entry points spawn and update the registered behavior', () => {
  const sim = { next: { warden: 1 }, world: { width: 1000, height: 700 }, ai: {}, players: {}, danger: 1 };
  const enemy = spawnEnemy(sim, 'rust-warden', { x: 300, y: 300 });
  assert.equal(enemy.enemyType, 'rust-warden');
  assert.equal(enemy.behavior, 'warden-patrol-shooter');
  assert.equal(enemy.hp, enemy.maxHp);
  assert.equal(enemy.skillPoints, RUST_WARDEN.stats.skillPoints);
  assert.equal(typeof BEHAVIORS[enemy.behavior].spawn, 'function');
  assert.equal(typeof BEHAVIORS[enemy.behavior].update, 'function');
  assert.doesNotThrow(() => updateEnemies(sim, 100, 0.05));
});

test('unknown enemy ids fail clearly instead of silently spawning the wrong type', () => {
  const sim = { next: { warden: 1 }, world: { width: 1000, height: 700 }, ai: {}, players: {} };
  assert.throws(() => spawnEnemy(sim, 'missing-enemy'), /Unknown enemy type: missing-enemy/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { ENEMY_CATALOG, RUST_WARDEN, SCAVENGER_DRONE } = require('../server/content/enemies.js');
const { spawnEnemy, updateEnemies, BEHAVIORS } = require('../server/sim/enemy-registry.js');
const { scaledStats } = require('../server/sim/wardens.js');
const { WARDEN } = require('../server/sim/spec.js');
const { damageTarget } = require('../server/sim/combat.js');

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
  assert.equal(enemy.behavior, 'patrol-shooter');
  assert.equal(enemy.hp, enemy.maxHp);
  assert.equal(enemy.skillPoints, RUST_WARDEN.stats.skillPoints);
  assert.equal(typeof BEHAVIORS[enemy.behavior].spawn, 'function');
  assert.equal(typeof BEHAVIORS[enemy.behavior].update, 'function');
  assert.doesNotThrow(() => updateEnemies(sim, 100, 0.05));
});

test('small drones spawn from catalog values, share registered patrol behavior, and earn no skill point', () => {
  const sim = { next: { warden: 1 }, world: { width: 1000, height: 700 }, ai: {}, players: {}, danger: 1 };
  const warden = spawnEnemy(sim, RUST_WARDEN.id, { x: 400, y: 300 });
  const drone = spawnEnemy(sim, SCAVENGER_DRONE.id, { x: 300, y: 300 });
  assert.equal(SCAVENGER_DRONE.size, 'small');
  assert.equal(SCAVENGER_DRONE.spawnCount, 2);
  assert.equal(drone.behavior, warden.behavior);
  assert.equal(drone.size, 'small');
  assert.equal(drone.hp, 35);
  assert.equal(drone.speed, 105);
  assert.equal(drone.skillPoints, 0);
  assert.equal(drone.coreCharge, 2);
  const before = { x: drone.x, y: drone.y };
  const originalRandom = Math.random;
  try {
    Math.random = () => 0;
    updateEnemies(sim, 100, 0.5);
  } finally {
    Math.random = originalRandom;
  }
  assert.notDeepEqual({ x: drone.x, y: drone.y }, before, 'the small drone patrol behavior updates it');
});

test('drone kill rewards honor zero skill points and its smaller XP/credit bounty', () => {
  const killer = { id: 'player-1', kind: 'player', skillPoints: 0, coreCharge: 0, credits: 0, inventory: [] };
  const drone = { id: 'drone-1', kind: 'ai', hp: 1, tier: 1, xp: 4, credits: 4, skillPoints: 0, coreCharge: 2, name: 'Scavenger Drone', x: 10, y: 10 };
  const sim = {
    kind: 'wild', ai: { [drone.id]: drone }, players: { [killer.id]: killer }, send() {},
    host: {
      applyXp(player, amount) { player.xp = (player.xp || 0) + amount; },
      awardNearbyParty() {}, persistPlayer() {}, playerSockets: { [killer.id]: { emit() {} } }
    }
  };
  const originalRandom = Math.random;
  try {
    Math.random = () => 0.99;
    damageTarget(sim, drone, 2, killer);
  } finally {
    Math.random = originalRandom;
  }
  assert.equal(killer.skillPoints, 0);
  assert.equal(killer.coreCharge, 2);
  assert.equal(killer.credits, 4);
  assert.equal(killer.xp, 4);
});

test('unknown enemy ids fail clearly instead of silently spawning the wrong type', () => {
  const sim = { next: { warden: 1 }, world: { width: 1000, height: 700 }, ai: {}, players: {} };
  assert.throws(() => spawnEnemy(sim, 'missing-enemy'), /Unknown enemy type: missing-enemy/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const module = require('../server/modules/core-meditation.js');
const hooks = new Map();
const playerSockets = {};
const ctx = {
  on: (name, fn) => hooks.set(name, fn),
  playerSockets: () => playerSockets,
  persistPlayer: () => {}
};
module.setup(ctx);

function makePlayer() {
  return { id: 'meditator', x: 500, y: 350, hp: 100, maxHp: 100, credits: 0, lastAttackAt: 0, lastDashAt: 0, lastShieldAt: 0, lastAbilityAt: 0 };
}
function makeZone(player) {
  return { kind: 'haven', players: { [player.id]: player }, broadcasts: 0, broadcast() { this.broadcasts += 1; } };
}

test('Core meditation pays after idling and stops at the daily cap', () => {
  hooks.get('left')({ id: 'meditator' });
  const player = makePlayer();
  const zone = makeZone(player);
  hooks.get('joining')(player, {});
  hooks.get('tick')(zone, 1000);
  hooks.get('tick')(zone, 30999);
  assert.equal(player.credits, 0);
  hooks.get('tick')(zone, 31000);
  assert.equal(player.credits, 5);
  hooks.get('tick')(zone, 331000);
  hooks.get('tick')(zone, 631000);
  hooks.get('tick')(zone, 931000);
  hooks.get('tick')(zone, 1231000);
  assert.equal(player.credits, 20);
  assert.equal(player.meditationCredits, 20);
});

test('every safe-city Cipher Core heals by 3% maximum health per second and caps at full health', () => {
  hooks.get('left')({ id: 'meditator' });
  const player = makePlayer();
  player.hp = 40;
  const zone = makeZone(player);
  hooks.get('joining')(player, {});
  hooks.get('tick')(zone, 1000, 1);
  assert.equal(player.hp, 43, 'one second in a haven Core restores 3% maximum HP');
  player.hp = 99;
  hooks.get('tick')(zone, 2000, 1);
  assert.equal(player.hp, 100, 'healing never exceeds maximum HP');
  player.x = 700;
  hooks.get('tick')(zone, 3000, 1);
  assert.equal(player.hp, 100, 'leaving the Core ends healing');
  player.hp = 50;
  zone.kind = 'wild';
  player.x = 500;
  hooks.get('tick')(zone, 4000, 1);
  assert.equal(player.hp, 50, 'combat wilderness has no safe-Core healing');
});

test('movement cancels the current idle wait without spending in combat zones', () => {
  hooks.get('left')({ id: 'meditator' });
  const player = makePlayer();
  const zone = makeZone(player);
  hooks.get('joining')(player, {});
  hooks.get('tick')(zone, 1000);
  player.x += 10;
  hooks.get('tick')(zone, 31000);
  assert.equal(player.credits, 0);
  zone.kind = 'wild';
  hooks.get('tick')(zone, 400000);
  assert.equal(player.credits, 0);
});

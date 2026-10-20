import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHookBus } from '../server/hook-bus.js';
import { cipherTowerDialogue, shouldShowCipherMessage } from '../public/src/modules/cipher-companion.js';

const require = createRequire(import.meta.url);
const { zoneCatalog, worldMapPayload } = require('../server/zones-catalog.js');
const { createSimulation } = require('../server/sim/state.js');
const { spawnWarden } = require('../server/sim/wardens.js');
const { canUseExit } = require('../server/exit-rules.js');
const expanse = zoneCatalog().find((zone) => zone.id === 'wild-eastern-expanse');
const citadel = zoneCatalog().find((zone) => zone.id === 'haven-citadel');

test('Cipher dialogue welcomes new operatives and has a message for every tower clear', () => {
  const welcome = cipherTowerDialogue({ cipherIntro: true });
  assert.match(welcome.message, /Thank you for bringing the tower back online/);
  assert.equal(shouldShowCipherMessage({ cipherTowerClear: true }), true);
  for (let index = 1; index <= 5; index += 1) {
    const payload = { index, name: 'Tower ' + index, cipherTowerClear: true };
    assert.equal(shouldShowCipherMessage(payload), true);
    const dialogue = cipherTowerDialogue(payload);
    assert.ok(dialogue.message.includes('Tower ' + index));
    if (index === 5) assert.match(dialogue.message, /eastern passage is open/);
  }
  assert.equal(shouldShowCipherMessage({ index: 2 }), false);
});

test('Tower 5 opens only the per-operative east gate into the large guardian frontier', () => {
  assert.equal(canUseExit({ towers: {} }, citadel, 'east').ok, false);
  assert.equal(canUseExit({ towers: { 5: true } }, citadel, 'east').ok, true);
  assert.deepEqual(expanse.world, { width: 3000, height: 2100 });
  assert.equal(expanse.bossSites.length, 5);
  assert.equal(expanse.guardianSpawns.length, 4);
  assert.equal(expanse.exits.west, 'haven-citadel');
  const mapZone = worldMapPayload().find((zone) => zone.id === expanse.id);
  assert.deepEqual(mapZone.world, expanse.world);
  assert.equal(mapZone.bossSites.length, 5);

  const simulation = createSimulation(expanse, { scoreLimit: 400 });
  assert.deepEqual(simulation.world, expanse.world);
  assert.equal(simulation.bossSites.length, 5);
  for (const point of expanse.guardianSpawns) spawnWarden(simulation, { x: point.x, y: point.y, tier: expanse.danger });
  assert.equal(Object.keys(simulation.ai).length, 4);
  assert.ok(Object.values(simulation.ai).every((guardian) => guardian.name === 'Rust Warden'));
  assert.ok(Object.values(simulation.ai).every((guardian) => guardian.x >= 0 && guardian.x <= 3000 && guardian.y >= 0 && guardian.y <= 2100));
});

test('tower-clear companion message marker is independent of first-contact persistence', () => {
  const events = [];
  const bus = createHookBus();
  bus.on('net:tower-cleared', (payload) => events.push(payload));
  for (let index = 1; index <= 5; index += 1) bus.emit('net:tower-cleared', { index, cipherIntro: index === 1, cipherTowerClear: true });
  assert.equal(events.length, 5);
  assert.equal(events.every(shouldShowCipherMessage), true);
  assert.deepEqual(events.map((payload) => payload.cipherIntro), [true, false, false, false, false]);
});

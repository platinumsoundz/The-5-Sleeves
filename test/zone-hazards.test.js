import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const hazards = require('../server/modules/zone-hazards.js');

test('hazard cycle clearly separates idle, warning, and active phases', () => {
  assert.deepEqual(hazards.phaseAt(0), { phase: 'idle', endsAt: 5000 });
  assert.deepEqual(hazards.phaseAt(5000), { phase: 'warning', endsAt: 8000 });
  assert.deepEqual(hazards.phaseAt(8000), { phase: 'active', endsAt: 10000 });
});

test('wilderness hazards damage once per cycle and send a warning state', () => {
  const handlers = {};
  hazards.setup({ on: (event, handler) => { handlers[event] = handler; }, playerZone() {} });
  const player = { id: 'hazard-test', x: 270, y: 500, hp: 100, maxHp: 100, shieldUntil: 0 };
  const events = [];
  const zone = {
    id: 'wild-coast', kind: 'wild', players: { [player.id]: player }, send: (...args) => events.push(args),
    host: { playerSockets: {}, applyXp() {}, persistPlayer() {} }
  };

  handlers.tick(zone, 5000);
  assert.equal(events[0][0], 'environment:hazards');
  assert.equal(events[0][1][0].phase, 'warning');
  handlers.tick(zone, 8000);
  assert.equal(player.hp, 88);
  handlers.tick(zone, 8050);
  assert.equal(player.hp, 88, 'one field cannot repeatedly damage during its active window');
  handlers.tick(zone, 18000);
  assert.equal(player.hp, 76, 'the field can damage again in its next cycle');
});

test('safe zones block damage even if a road hazard overlaps them', () => {
  const handlers = {};
  hazards.setup({ on: (event, handler) => { handlers[event] = handler; }, playerZone() {} });
  const player = { id: 'protected', x: 270, y: 500, hp: 100, maxHp: 100 };
  const zone = { id: 'wild-coast', kind: 'wild', safe: { x: 0, y: 0, width: 1000, height: 700 }, players: { [player.id]: player }, send() {} };
  handlers.tick(zone, 8000);
  assert.equal(player.hp, 100);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  autoAimVector, FIRE_REPEAT_MS, getShootingMode, normalizeAim, normalizeMode,
  setShootingMode, shouldRepeatFire, SHOOTING_MODE
} from '../public/src/shooting.js';

test('shooting mode accepts only the supported choices and defaults to auto-aim', () => {
  assert.equal(normalizeMode(SHOOTING_MODE.TWIN), SHOOTING_MODE.TWIN);
  assert.equal(normalizeMode('unknown'), SHOOTING_MODE.AUTO);
  assert.equal(getShootingMode(), SHOOTING_MODE.AUTO);
});

test('shooting style persists and updates the twin-stick presentation', () => {
  const names = ['localStorage', 'window', 'document', 'CustomEvent'];
  const before = Object.fromEntries(names.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  const values = new Map();
  let twinStickVisible = false, eventMode = null;
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) } });
  Object.defineProperty(globalThis, 'CustomEvent', { configurable: true, value: class { constructor(type, init) { this.type = type; this.detail = init.detail; } } });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { dispatchEvent: (event) => { eventMode = event.detail; } } });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { body: { classList: { toggle: (_name, visible) => { twinStickVisible = visible; } } } } });
  try {
    setShootingMode(SHOOTING_MODE.TWIN);
    assert.equal(getShootingMode(), SHOOTING_MODE.TWIN);
    assert.equal(twinStickVisible, true);
    assert.equal(eventMode, SHOOTING_MODE.TWIN);
    setShootingMode(SHOOTING_MODE.AUTO);
    assert.equal(getShootingMode(), SHOOTING_MODE.AUTO);
    assert.equal(twinStickVisible, false);
  } finally {
    for (const name of names) {
      if (before[name]) Object.defineProperty(globalThis, name, before[name]);
      else delete globalThis[name];
    }
  }
});

test('aim vectors normalize and reject zero-length input', () => {
  assert.deepEqual(normalizeAim(0, 0), null);
  const diagonal = normalizeAim(3, 4);
  assert.ok(Math.abs(diagonal.x - 0.6) < 1e-9);
  assert.ok(Math.abs(diagonal.y - 0.8) < 1e-9);
});

test('auto-aim selects the nearest living Warden within range', () => {
  const state = {
    localPlayer: { id: 'self', x: 0, y: 0 },
    ai: {
      distant: { x: -300, y: 0, hp: 50 },
      nearest: { x: 0, y: 80, hp: 10 },
      dead: { x: 0, y: 10, hp: 0 },
      far: { x: 700, y: 0, hp: 50 }
    }
  };
  assert.deepEqual(autoAimVector(state), { x: 0, y: 1 });
  assert.equal(autoAimVector({ localPlayer: { x: 0, y: 0 }, ai: {} }), null);
});

test('auto-aim in PvP arenas ignores self and teammates', () => {
  const state = {
    localPlayer: { id: 'self', x: 0, y: 0, arenaTeam: 'blue' },
    zone: { arena: true, alignment: 'pvp' },
    players: {
      self: { id: 'self', x: 0, y: 0, arenaTeam: 'blue' },
      ally: { id: 'ally', x: 10, y: 0, hp: 100, arenaTeam: 'blue' },
      rival: { id: 'rival', x: 0, y: 100, hp: 100, arenaTeam: 'red' }
    },
    ai: {}
  };
  assert.deepEqual(autoAimVector(state), { x: 0, y: 1 });
});

test('held-fire repeats at 500 ms, safely beyond server cooldown', () => {
  assert.equal(FIRE_REPEAT_MS, 500);
  assert.equal(shouldRepeatFire(1499, 1000), false);
  assert.equal(shouldRepeatFire(1500, 1000), true);
});

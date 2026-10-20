import test from 'node:test';
import assert from 'node:assert/strict';
import { createHookBus } from '../server/hook-bus.js';
import customisation from '../server/modules/player-customisation.js';
import { PLAYER_PALETTES, DEFAULT_PALETTE, findPalette } from '../server/player-palettes.js';
import { PLAYER_PALETTES as CLIENT_PALETTES, DOMAINS } from '../public/src/config.js';

function harness() {
  const hooks = createHookBus();
  const sockets = {};
  const persisted = [];
  const broadcasts = [];
  customisation.setup({
    on: (event, handler) => hooks.on(event, handler),
    registerSocket: (name, handler) => { sockets[name] = handler; },
    persistPlayer: (player) => persisted.push(player),
    playerZone: () => ({ broadcast: () => broadcasts.push(1) })
  });
  return { hooks, sockets, persisted, broadcasts };
}

function socketSpy() {
  const events = [];
  return { events, emit: (name, payload) => events.push({ name, payload }) };
}

test('client and server palette tables stay in sync', () => {
  assert.deepEqual(
    CLIENT_PALETTES.map((palette) => [palette.id, palette.hex]),
    PLAYER_PALETTES.map((palette) => [palette.id, palette.hex])
  );
  assert.equal(CLIENT_PALETTES.length, 8);
  assert.ok(DEFAULT_PALETTE);
  assert.ok(PLAYER_PALETTES.every((palette) => /^#[0-9a-f]{6}$/i.test(palette.hex)));
});

test('findPalette accepts ids and hex values, rejects junk', () => {
  assert.equal(findPalette('gold')?.hex, '#ffd86b');
  assert.equal(findPalette('#FFD86B')?.id, 'gold');
  assert.equal(findPalette('not-a-colour'), null);
  assert.equal(findPalette(null), null);
});

test('joining applies the chosen faction and restores the saved palette', () => {
  const { hooks } = harness();
  const player = { id: 'p1', energyColor: 'cipher', color: '#00ffff', accentColor: '#78ff5f', requestedFaction: 'water' };
  hooks.emit('joining', player, { palette: 'gold' });
  assert.equal(player.energyColor, 'water');
  assert.equal(player.color, '#0088ff');
  assert.equal(player.accentColor, '#71d5ff');
  assert.equal(player.palette, '#ffd86b');
  assert.equal('requestedFaction' in player, false, 'join-only field is cleaned up');
});

test('joining ignores unknown factions and falls back to the default palette', () => {
  const { hooks } = harness();
  const player = { id: 'p2', energyColor: 'earth', color: '#cc7722', accentColor: '#f0b768', requestedFaction: 'azure' };
  hooks.emit('joining', player, {});
  assert.equal(player.energyColor, 'earth', 'legacy/unknown faction leaves the profile choice');
  assert.equal(player.palette, findPalette(DEFAULT_PALETTE)?.hex);
});

test('the palette socket persists the choice and broadcasts it', () => {
  const { hooks, sockets, persisted, broadcasts } = harness();
  const player = { id: 'p3', energyColor: 'fire', color: '#ff4400', accentColor: '#ffb347' };
  hooks.emit('joining', player, {});
  const socket = socketSpy();
  sockets['player:palette'](player, { palette: 'rose' }, socket);
  assert.equal(player.palette, '#ff6f9c');
  assert.equal(persisted.length, 1);
  assert.equal(broadcasts.length, 1);
  assert.equal(socket.events[0].name, 'palette:update');
  assert.equal(socket.events[0].payload.palette, '#ff6f9c');
});

test('an invalid palette socket call changes nothing', () => {
  const { hooks, sockets, persisted } = harness();
  const player = { id: 'p4', energyColor: 'wind', color: '#00ff88', accentColor: '#a7ffd0' };
  hooks.emit('joining', player, {});
  const before = player.palette;
  const socket = socketSpy();
  sockets['player:palette'](player, { palette: 'neon-nope' }, socket);
  assert.equal(player.palette, before);
  assert.equal(persisted.length, 0);
  assert.equal(socket.events.length, 0);
});

test('the palette is written into the persisted profile record', () => {
  const { hooks } = harness();
  const player = { id: 'p5', requestedFaction: 'dark' };
  hooks.emit('joining', player, {});
  const record = {};
  hooks.emit('persist', player, record);
  assert.equal(record.palette, player.palette);
});

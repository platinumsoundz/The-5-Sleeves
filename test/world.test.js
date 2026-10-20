import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { io } from 'socket.io-client';
import { TEST_PROFILE_FILE } from '../tools/profile-scratch.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const require = createRequire(import.meta.url);
const { createSimulation } = require('../server/sim/state.js');
const towerModule = require('../server/modules/tower-services.js');

const PORT = 3135;
const url = `http://127.0.0.1:${PORT}`;

function startServer() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['server.js'], { cwd: root, env: { ...process.env, PROFILE_FILE: TEST_PROFILE_FILE, PORT: String(PORT), MAX_WARDENS: '0' }, stdio: ['ignore', 'pipe', 'pipe'] });
    const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('server boot timeout')); }, 15000);
    child.stdout.on('data', (chunk) => { if (String(chunk).includes('is running')) { clearTimeout(timer); resolve(child); } });
    child.stderr.on('data', (chunk) => process.stderr.write(chunk));
    child.on('exit', (code) => { clearTimeout(timer); reject(new Error('server exited early: ' + code)); });
  });
}

function once(socket, event, predicate = () => true, timeout = 6000, label = event) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { socket.off(event, handler); reject(new Error('timed out waiting for ' + label)); }, timeout);
    function handler(payload) {
      if (!predicate(payload)) return;
      clearTimeout(timer); socket.off(event, handler); resolve(payload);
    }
    socket.on(event, handler);
  });
}

async function connect(name) {
  const socket = io(url, { transports: ['websocket'], forceNew: true });
  await once(socket, 'server:welcome');
  socket.emit('player:join', { name, zone: 'haven-perimeter' });
  const accepted = await once(socket, 'join:accepted');
  return { socket, id: accepted.playerId };
}

function switchTo(socket, zoneId, label) {
  const changed = once(socket, 'zone:changed', (payload) => payload.zone?.id === zoneId, 6000, label);
  socket.emit('zone:switch', zoneId);
  return changed;
}

test('fast travel refuses locked cities and links unlocked spawn points', async (t) => {
  const server = await startServer();
  const sockets = [];
  t.after(() => { sockets.forEach((socket) => socket.close()); server.kill('SIGKILL'); });

  const traveller = await connect('Travel' + Date.now().toString(36));
  sockets.push(traveller.socket);

  const blocked = once(traveller.socket, 'travel:error', (message) => String(message).includes('Reach'), 5000, 'locked city');
  traveller.socket.emit('city:travel', { zoneId: 'haven-coast' });
  assert.ok((await blocked).length > 0);

  await switchTo(traveller.socket, 'haven-coast', 'unlock coast');
  const back = once(traveller.socket, 'zone:changed', (payload) => payload.zone?.id === 'haven-perimeter', 6000, 'fast travel home');
  traveller.socket.emit('city:travel', { zoneId: 'haven-perimeter' });
  assert.equal((await back).zone.kind, 'haven');

  const again = once(traveller.socket, 'zone:changed', (payload) => payload.zone?.id === 'haven-coast', 6000, 'fast travel back');
  traveller.socket.emit('city:travel', { zoneId: 'haven-coast' });
  assert.equal((await again).zone.kind, 'haven');
});

test('a tower clears after three waves, pays credits and opens the east road', () => {
  const events = [];
  const socketEvents = [];
  const host = {
    io: { to: () => ({ emit: (event, payload) => events.push({ event, payload }) }) },
    scoreLimit: 400,
    applyXp: (player, amount) => { player.xp = (player.xp || 0) + amount; },
    persistPlayer: () => {},
    playerSockets: {},
    sameParty: () => false
  };
  const zone = createSimulation({
    id: 'tower-test', name: 'Tower Test', kind: 'tower', towerIndex: 1, danger: 1,
    book: 'Tower Test', spirit: 'Wind', tint: '', terminals: [], spawn: { x: 500, y: 610 },
    exits: { south: 'haven-coast' }, tower: { x: 500, y: 260, name: 'Tower 1' }
  }, host);
  const player = {
    id: 'p1', name: 'Climber', kind: 'player', hp: 100, maxHp: 100, x: 500, y: 500,
    xp: 0, credits: 0, skillPoints: 0, towers: {}, homeCity: 'haven-coast'
  };
  zone.players[player.id] = player;
  zone.memberCount = 1;
  host.playerSockets[player.id] = { emit: (event, payload) => socketEvents.push({ event, payload }) };

  const handlers = {};
  towerModule.setup({
    on: (event, handler) => { handlers[event] = handler; },
    playerZone: (id) => id === player.id ? zone : null,
    playerSockets: () => host.playerSockets,
    applyXp: host.applyXp,
    persistPlayer: host.persistPlayer
  });
  const tick = handlers.tick;
  assert.equal(typeof tick, 'function');

  const clearWave = (at) => {
    for (const warden of Object.values(zone.ai)) delete zone.ai[warden.id];
    tick(zone, at);
  };

  tick(zone, 1000); // idle -> starting
  tick(zone, 3300); // wave 1
  assert.equal(Object.keys(zone.ai).length, 3, 'first wave spawns three wardens');
  clearWave(4000);
  tick(zone, 5900); // wave 2
  assert.equal(zone.towerRun.wave, 2);
  clearWave(6000);
  tick(zone, 7900); // wave 3
  assert.equal(zone.towerRun.wave, 3);
  clearWave(8000);
  tick(zone, 9900); // clear

  assert.equal(zone.towerRun.state, 'cleared');
  assert.equal(player.towers[1], true, 'tower completion is saved on the operative');
  assert.equal(player.credits, 190, 'tower clear pays credits');
  assert.ok(player.xp > 0, 'tower clear pays XP');
  assert.ok(socketEvents.some((entry) => entry.event === 'tower:cleared' && entry.payload.index === 1));
  assert.ok(events.some((entry) => entry.event === 'tower:state' && entry.payload.state === 'cleared'));
});

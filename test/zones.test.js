import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { io } from 'socket.io-client';
import { TEST_PROFILE_FILE } from '../tools/profile-scratch.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PORT = 3132;
const url = `http://127.0.0.1:${PORT}`;

const START_VILLAGE = 'haven-perimeter';

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

async function connect(name, zone) {
  const socket = io(url, { transports: ['websocket'], forceNew: true });
  const lobby = once(socket, 'zones:lobby');
  await once(socket, 'server:welcome');
  socket.emit('player:join', { name, zone: zone || START_VILLAGE });
  const accepted = await once(socket, 'join:accepted');
  return { socket, id: accepted.playerId, accepted, lobby: await lobby };
}

function delay(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

async function walkThroughEdge(socket, point, event, expected, label) {
  let arrived = false;
  const changed = once(socket, event, (payload) => (payload.zone?.id || payload.id) === expected, 10000, label)
    .finally(() => { arrived = true; });
  // The gate needs a second move after the 320 ms hold. Repeat it a few times
  // so a loaded machine that coalesces packets cannot strand the walker.
  for (let attempt = 0; attempt < 4 && !arrived; attempt += 1) {
    socket.emit('player:move', point);
    await delay(380);
  }
  return changed;
}

test('the title screen advertises only the starting village', async (t) => {
  const server = await startServer();
  const sockets = [];
  t.after(() => { sockets.forEach((socket) => socket.close()); server.kill('SIGKILL'); });

  const suffix = Date.now().toString(36);
  const client = await connect('Lobby' + suffix);
  sockets.push(client.socket);

  assert.deepEqual(client.lobby.map((zone) => zone.id), [START_VILLAGE], 'one unlockable starting point');
  const [start] = client.lobby;
  assert.ok(start.name && start.book && start.spirit, 'the village carries canon identity');
  assert.equal(typeof start.players, 'number');
  assert.equal(client.accepted.zone.id, START_VILLAGE);
  assert.equal(client.accepted.zone.kind, 'haven');
});

test('zones isolate their players and simulations', async (t) => {
  const server = await startServer();
  const sockets = [];
  t.after(() => { sockets.forEach((socket) => socket.close()); server.kill('SIGKILL'); });

  const suffix = Date.now().toString(36);
  const coast = await connect('Coast' + suffix, 'wild-coast');
  const frozen = await connect('Frozen' + suffix, 'haven-frozen');
  sockets.push(coast.socket, frozen.socket);

  assert.equal(coast.accepted.zone.id, 'wild-coast');
  assert.equal(coast.accepted.zone.spirit, 'Water');
  assert.equal(coast.accepted.zone.kind, 'wild');
  assert.equal(frozen.accepted.zone.id, 'haven-frozen');
  assert.equal(frozen.accepted.zone.kind, 'haven');

  const coastRoster = await once(coast.socket, 'players', (players) => players[coast.id], 6000, 'coast roster');
  const frozenRoster = await once(frozen.socket, 'players', (players) => players[frozen.id], 6000, 'frozen roster');
  assert.ok(coastRoster[coast.id], 'coast operative sees themselves');
  assert.equal(coastRoster[frozen.id], undefined, 'coast operative cannot see frozen players');
  assert.ok(frozenRoster[frozen.id], 'frozen operative sees themselves');
  assert.equal(frozenRoster[coast.id], undefined, 'frozen operative cannot see coast players');

  coast.socket.emit('player:move', { x: 300, y: 300 });
  const moved = await once(coast.socket, 'players', (players) => players[coast.id] && Math.abs(players[coast.id].x - 300) < 1, 6000, 'coast move');
  assert.equal(moved[frozen.id], undefined);
});

test('operatives can travel between cities and read their terminals', async (t) => {
  const server = await startServer();
  const sockets = [];
  t.after(() => { sockets.forEach((socket) => socket.close()); server.kill('SIGKILL'); });

  const suffix = Date.now().toString(36);
  const traveller = await connect('Traveller' + suffix);
  sockets.push(traveller.socket);

  const switched = once(traveller.socket, 'players', (players) => players[traveller.id], 6000, 'post-switch roster');
  const lobbyWait = once(traveller.socket, 'zones:lobby', (zones) => zones.find((zone) => zone.id === START_VILLAGE)?.players === 0, 8000, 'lobby count update');
  const terminalsWait = once(traveller.socket, 'archive:terminals', (payload) => payload.zoneId === 'haven-frozen', 6000, 'zone terminals');
  const mapWait = once(traveller.socket, 'world:map', (map) => map.some((zone) => zone.id === 'haven-frozen'), 6000, 'world map');
  traveller.socket.emit('zone:switch', 'haven-frozen');
  await switched;

  const lobby = await lobbyWait;
  assert.equal(lobby.find((zone) => zone.id === START_VILLAGE).players, 0, 'left the old zone');

  const terminals = await terminalsWait;
  assert.ok(terminals.terminals.length >= 2, 'frozen wastes has its own terminals');
  assert.ok(terminals.terminals.some((terminal) => terminal.id === 'terminal-vault-cold'));

  const map = await mapWait;
  assert.equal(map.filter((zone) => zone.kind === 'tower').length, 5, 'five towers on the world map');
  assert.equal(map.filter((zone) => zone.kind === 'haven').length, 6, 'six safe cities');
  assert.equal(map.filter((zone) => zone.kind === 'arena').length, 0, 'arenas stay private');
});

test('walking east leaves the village for the wilderness and west returns', async (t) => {
  const server = await startServer();
  const sockets = [];
  t.after(() => { sockets.forEach((socket) => socket.close()); server.kill('SIGKILL'); });

  const suffix = Date.now().toString(36);
  const walker = await connect('Walker' + suffix);
  sockets.push(walker.socket);

  const out = await walkThroughEdge(walker.socket, { x: 965, y: 350 }, 'zone:changed', 'wild-perimeter', 'east road');
  assert.equal(out.zone.kind, 'wild');
  assert.equal(out.spawn.x < 100, true, 'entered the wild road from the west edge');

  // The road cooldown stops a single step from bouncing straight back.
  await delay(1000);
  const back = await walkThroughEdge(walker.socket, { x: 40, y: 350 }, 'zone:changed', 'haven-perimeter', 'west road');
  assert.equal(back.zone.kind, 'haven');
});

test('a city east road stays gated until its tower is cleared', async (t) => {
  const server = await startServer();
  const sockets = [];
  t.after(() => { sockets.forEach((socket) => socket.close()); server.kill('SIGKILL'); });

  const suffix = Date.now().toString(36);
  const citizen = await connect('Citizen' + suffix, 'haven-coast');
  sockets.push(citizen.socket);

  let noticed = false;
  const notice = once(citizen.socket, 'hub:notice', (text) => String(text).includes('Clear Tower 1'), 10000, 'tower gate notice')
    .finally(() => { noticed = true; });
  // Same hold rule as a road: repeat the east-edge nudge until the gate answers.
  for (let attempt = 0; attempt < 4 && !noticed; attempt += 1) {
    citizen.socket.emit('player:move', { x: 965, y: 350 });
    await delay(380);
  }
  await notice;

  // The north gate still leads into the tower itself.
  const tower = await walkThroughEdge(citizen.socket, { x: 500, y: 40 }, 'zone:changed', 'tower-1', 'tower gate');
  assert.equal(tower.zone.kind, 'tower');
  assert.equal(tower.zone.towerIndex, 1);
});

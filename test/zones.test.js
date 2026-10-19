import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { io } from 'socket.io-client';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PORT = 3132;
const url = `http://127.0.0.1:${PORT}`;

const CANON_ZONES = ['the-perimeter', 'sunken-coast', 'scorched-wastes', 'frozen-wastes', 'apex-citadel'];

function startServer() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['server.js'], { cwd: root, env: { ...process.env, PORT: String(PORT), MAX_WARDENS: '0' }, stdio: ['ignore', 'pipe', 'pipe'] });
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
  socket.emit('player:join', zone ? { name, zone } : name);
  const accepted = await once(socket, 'join:accepted');
  return { socket, id: accepted.playerId, accepted, lobby: await lobby };
}

test('the lobby advertises all five canon zones', async (t) => {
  const server = await startServer();
  const sockets = [];
  t.after(() => { sockets.forEach((socket) => socket.close()); server.kill('SIGKILL'); });

  const suffix = Date.now().toString(36);
  const client = await connect('Lobby' + suffix);
  sockets.push(client.socket);

  assert.equal(client.lobby.length, CANON_ZONES.length, 'five zones listed');
  assert.deepEqual(client.lobby.map((zone) => zone.id).sort(), [...CANON_ZONES].sort(), 'canon zone ids');
  for (const zone of client.lobby) {
    assert.ok(zone.name && zone.book && zone.spirit, zone.id + ' carries canon identity');
    assert.equal(typeof zone.players, 'number');
  }
  assert.equal(client.accepted.zone.id, 'the-perimeter', 'default zone is the Perimeter');
});

test('zones isolate their players and simulations', async (t) => {
  const server = await startServer();
  const sockets = [];
  t.after(() => { sockets.forEach((socket) => socket.close()); server.kill('SIGKILL'); });

  const suffix = Date.now().toString(36);
  const coast = await connect('Coast' + suffix, 'sunken-coast');
  const perimeter = await connect('Perim' + suffix, 'the-perimeter');
  sockets.push(coast.socket, perimeter.socket);

  assert.equal(coast.accepted.zone.id, 'sunken-coast');
  assert.equal(coast.accepted.zone.spirit, 'Water');
  assert.equal(perimeter.accepted.zone.id, 'the-perimeter');

  // Each operative receives a players broadcast for their own zone only.
  const coastRoster = await once(coast.socket, 'players', (players) => players[coast.id], 6000, 'coast roster');
  const perimeterRoster = await once(perimeter.socket, 'players', (players) => players[perimeter.id], 6000, 'perimeter roster');
  assert.ok(coastRoster[coast.id], 'coast operative sees themselves');
  assert.equal(coastRoster[perimeter.id], undefined, 'coast operative cannot see perimeter players');
  assert.ok(perimeterRoster[perimeter.id], 'perimeter operative sees themselves');
  assert.equal(perimeterRoster[coast.id], undefined, 'perimeter operative cannot see coast players');

  // A move in one zone never reaches the other zone's roster.
  coast.socket.emit('player:move', { x: 300, y: 300 });
  const moved = await once(coast.socket, 'players', (players) => players[coast.id] && Math.abs(players[coast.id].x - 300) < 1, 6000, 'coast move');
  assert.equal(moved[perimeter.id], undefined);
});

test('operatives can travel between canon zones', async (t) => {
  const server = await startServer();
  const sockets = [];
  t.after(() => { sockets.forEach((socket) => socket.close()); server.kill('SIGKILL'); });

  const suffix = Date.now().toString(36);
  const traveller = await connect('Traveller' + suffix);
  sockets.push(traveller.socket);

  // Register all waiters BEFORE switching so no broadcast is missed.
  const switched = once(traveller.socket, 'players', (players) => players[traveller.id], 6000, 'post-switch roster');
  const lobbyWait = once(traveller.socket, 'zones:lobby', (zones) => zones.find((zone) => zone.id === 'frozen-wastes')?.players === 1, 8000, 'lobby count update');
  const terminalsWait = once(traveller.socket, 'archive:terminals', (payload) => payload.zoneId === 'frozen-wastes', 6000, 'zone terminals');
  traveller.socket.emit('zone:switch', 'frozen-wastes');
  await switched;

  const lobby = await lobbyWait;
  assert.equal(lobby.find((zone) => zone.id === 'the-perimeter').players, 0, 'left the old zone');

  // Each zone ships its own terminal set from the canon catalog.
  const terminals = await terminalsWait;
  assert.ok(terminals.terminals.length >= 2, 'frozen wastes has its own terminals');
  assert.ok(terminals.terminals.some((terminal) => terminal.id === 'terminal-vault-cold'));
});

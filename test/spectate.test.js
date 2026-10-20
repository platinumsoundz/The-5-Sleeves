import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { io } from 'socket.io-client';
import { TEST_PROFILE_FILE } from '../tools/profile-scratch.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PORT = 3134;
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

function once(socket, event, predicate = () => true, timeout = 8000, label = event) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { socket.off(event, handler); reject(new Error('timed out waiting for ' + label)); }, timeout);
    function handler(payload) {
      if (!predicate(payload)) return;
      clearTimeout(timer); socket.off(event, handler); resolve(payload);
    }
    socket.on(event, handler);
  });
}

test('the replay buffer records live zones and is served as JSON', async (t) => {
  const server = await startServer();
  const sockets = [];
  t.after(() => { sockets.forEach((socket) => socket.close()); server.kill('SIGKILL'); });

  const socket = io(url, { transports: ['websocket'], forceNew: true });
  sockets.push(socket);
  await once(socket, 'server:welcome');
  socket.emit('player:join', { name: 'Recorded' + Date.now().toString(36), zone: 'wild-coast' });
  const accepted = await once(socket, 'join:accepted');

  // Wait for a few 200 ms samples.
  await new Promise((resolve) => setTimeout(resolve, 1200));

  const replay = await fetch(`http://127.0.0.1:${PORT}/api/replay/wild-coast`).then((response) => response.json());
  assert.equal(replay.zone.id, 'wild-coast');
  assert.ok(replay.frames.length >= 3, 'rolling buffer has samples (' + replay.frames.length + ')');
  const last = replay.frames[replay.frames.length - 1];
  assert.ok(last.at > 0 && last.players[accepted.playerId], 'frames carry the live roster');

  const empty = await fetch(`http://127.0.0.1:${PORT}/api/replay/haven-perimeter`).then((response) => response.json());
  assert.equal(empty.zone.id, 'haven-perimeter');
  assert.equal(empty.frames.length, 0, 'zones without operatives keep no history');

  const missing = await fetch(`http://127.0.0.1:${PORT}/api/replay/nowhere`);
  assert.equal(missing.status, 404);
});

test('an observer joins a zone without becoming an operative', async (t) => {
  const server = await startServer();
  const sockets = [];
  t.after(() => { sockets.forEach((socket) => socket.close()); server.kill('SIGKILL'); });

  const suffix = Date.now().toString(36);
  const player = io(url, { transports: ['websocket'], forceNew: true });
  sockets.push(player);
  await once(player, 'server:welcome');
  player.emit('player:join', { name: 'Watchee' + suffix, zone: 'haven-perimeter' });
  const accepted = await once(player, 'join:accepted');

  const observer = io(url, { transports: ['websocket'], forceNew: true });
  sockets.push(observer);
  await once(observer, 'server:welcome');
  const acceptedSpectate = once(observer, 'spectate:accepted');
  observer.emit('spectate:join', { zone: 'haven-perimeter' });
  const spectate = await acceptedSpectate;
  assert.equal(spectate.zone.id, 'haven-perimeter');
  assert.ok(Array.isArray(spectate.frames), 'observer receives the backlog immediately');

  // Live snapshots keep arriving from the shared zone room.
  const roster = await once(observer, 'players', (players) => players[accepted.playerId], 8000, 'live roster');
  assert.equal(roster[observer.id], undefined, 'the observer is not on the roster');
});

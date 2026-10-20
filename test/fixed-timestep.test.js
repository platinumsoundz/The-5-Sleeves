import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { io } from 'socket.io-client';
import { TEST_PROFILE_FILE } from '../tools/profile-scratch.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PORT = 3133;
const url = `http://127.0.0.1:${PORT}`;

function startServer(env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['server.js'], { cwd: root, env: { ...process.env, PROFILE_FILE: TEST_PROFILE_FILE, PORT: String(PORT), MAX_WARDENS: '0', ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
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

test('snapshots are broadcast on the BROADCAST_MS cadence, not the sim step', async (t) => {
  const server = await startServer({ FIXED_DT_MS: '40', BROADCAST_MS: '120' });
  const socket = io(url, { transports: ['websocket'], forceNew: true });
  t.after(() => { socket.close(); server.kill('SIGKILL'); });

  await once(socket, 'server:welcome');
  socket.emit('player:join', 'Timestep' + Date.now().toString(36));
  const accepted = await once(socket, 'join:accepted');

  let snapshots = 0;
  const counter = (players) => { if (players[accepted.playerId]) snapshots += 1; };
  socket.on('players', counter);
  await new Promise((resolve) => setTimeout(resolve, 1200));
  socket.off('players', counter);

  // 1200 ms at 120 ms per snapshot ≈ 10. Allow slop for startup jitter, but
  // the old 50 ms loop would have produced ≈ 24.
  assert.ok(snapshots >= 4, 'snapshots keep flowing (' + snapshots + ')');
  assert.ok(snapshots <= 16, 'snapshots honour BROADCAST_MS (' + snapshots + ')');
});

test('a non-default fixed timestep still simulates movement', async (t) => {
  const server = await startServer({ FIXED_DT_MS: '100', BROADCAST_MS: '100' });
  const socket = io(url, { transports: ['websocket'], forceNew: true });
  t.after(() => { socket.close(); server.kill('SIGKILL'); });

  await once(socket, 'server:welcome');
  socket.emit('player:join', 'Step' + Date.now().toString(36));
  const accepted = await once(socket, 'join:accepted');
  socket.emit('player:move', { x: 400, y: 400 });
  const moved = await once(socket, 'players', (players) => players[accepted.playerId] && Math.abs(players[accepted.playerId].x - 400) < 1, 6000, 'moved player');
  assert.ok(Math.abs(moved[accepted.playerId].y - 400) < 1);

  const health = await fetch(`http://127.0.0.1:${PORT}/health`).then((response) => response.json());
  assert.equal(health.status, 'ok');
  assert.equal(health.players, 1);
});

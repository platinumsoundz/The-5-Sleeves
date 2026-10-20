import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { io } from 'socket.io-client';
import { TEST_PROFILE_FILE } from '../tools/profile-scratch.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PORT = 3127;
const url = `http://127.0.0.1:${PORT}`;

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { scaledStats } = require('../server/sim/wardens.js');

function startServer(env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['server.js'], { cwd: root, env: { ...process.env, PROFILE_FILE: TEST_PROFILE_FILE, PORT: String(PORT), ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
    const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('server boot timeout')); }, 15000);
    child.stdout.on('data', (chunk) => { if (String(chunk).includes('is running')) { clearTimeout(timer); resolve(child); } });
    child.stderr.on('data', (chunk) => process.stderr.write(chunk));
    child.on('exit', (code) => { clearTimeout(timer); reject(new Error('server exited early: ' + code)); });
  });
}

function once(socket, event, predicate = () => true, timeout = 5000, label = event) {
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
  socket.emit('player:join', name);
  const accepted = await once(socket, 'join:accepted');
  return { socket, id: accepted.playerId };
}

test('warden balance grows by explicit danger-tier steps', () => {
  const base = scaledStats(1);
  const tierThree = scaledStats(3);
  assert.equal(base.hp, 90);
  assert.equal(base.damage, 12);
  assert.equal(base.credits, 14);
  assert.equal(tierThree.hp, 140);
  assert.equal(tierThree.damage, 17);
  assert.equal(tierThree.xp, 23);
  assert.equal(tierThree.credits, 29);
});

const positions = (aiState) => Object.values(aiState).map((warden) => `${Math.round(warden.x)},${Math.round(warden.y)}`).join('|');

test('wardens patrol the ruins and broadcast their state', async (t) => {
  const server = await startServer();
  const sockets = [];
  t.after(() => { sockets.forEach((socket) => socket.close()); server.kill('SIGKILL'); });

  const operative = await connect('Scout' + Date.now().toString(36));
  sockets.push(operative.socket);

  const aiState = await once(operative.socket, 'ai', (payload) => Object.keys(payload || {}).length >= 4, 5000, 'four wardens');
  const wardens = Object.values(aiState);
  assert.equal(wardens.length, 4, 'the ruins are patrolled by four wardens');
  for (const warden of wardens) {
    assert.equal(warden.kind, 'ai');
    assert.equal(warden.name, 'Rust Warden');
    assert.equal(warden.hp, warden.maxHp);
    assert.ok(warden.x > 0 && warden.x < 1000 && warden.y > 0 && warden.y < 700, 'wardens stay inside the world');
    assert.ok(warden.radius > 0 && warden.maxHp > 0);
  }

  // At least one drone should be walking somewhere during a patrol window.
  const before = positions(aiState);
  const moved = await once(operative.socket, 'ai', (payload) => positions(payload || {}) !== before, 6000, 'warden patrol movement');
  assert.notEqual(positions(moved), before, 'wardens patrol on their own');
});

test('wardens chase and shoot nearby operatives', async (t) => {
  const server = await startServer();
  const sockets = [];
  t.after(() => { sockets.forEach((socket) => socket.close()); server.kill('SIGKILL'); });

  const operative = await connect('Target' + Date.now().toString(36));
  sockets.push(operative.socket);

  const aiState = await once(operative.socket, 'ai', (payload) => Object.keys(payload || {}).length >= 4, 5000, 'four wardens');
  const warden = Object.values(aiState)[0];

  // Walk right up to a warden so it acquires the operative.
  operative.socket.emit('player:move', { x: warden.x + 90, y: warden.y });
  await once(operative.socket, 'players', (players) => {
    const self = players[operative.id];
    return self && Math.hypot(self.x - (warden.x + 90), self.y - warden.y) < 30;
  }, 12000, 'operative reposition');

  const shot = await once(operative.socket, 'projectiles', (projectiles) =>
    Object.values(projectiles || {}).some((projectile) => projectile.hostile && projectile.ownerId === warden.id), 6000, 'warden shot');
  const hostile = Object.values(shot).find((projectile) => projectile.hostile && projectile.ownerId === warden.id);
  assert.ok(hostile.damage > 0, 'warden shots carry damage');

  // Wardens are hostile to operatives (and not to each other).
  const hit = await once(operative.socket, 'combat:hit', (payload) => payload.targetId === operative.id && payload.sourceId === warden.id, 6000, 'warden hit');
  assert.ok(hit.amount > 0, 'warden fire hurts operatives');
});

test('downing a warden rewards the operative with XP', async (t) => {
  const server = await startServer({ MAX_WARDENS: '1' });
  const sockets = [];
  t.after(() => { sockets.forEach((socket) => socket.close()); server.kill('SIGKILL'); });

  const operative = await connect('Hunter' + Date.now().toString(36));
  sockets.push(operative.socket);

  const aiState = await once(operative.socket, 'ai', (payload) => Object.keys(payload || {}).length >= 1, 5000, 'a warden');
  const target = Object.values(aiState)[0];

  operative.socket.emit('player:move', { x: target.x - 140, y: target.y });
  await once(operative.socket, 'players', (players) => {
    const self = players[operative.id];
    return self && Math.hypot(self.x - (target.x - 140), self.y - target.y) < 30;
  }, 12000, 'operative reposition');

  const killWaiter = once(operative.socket, 'combat:kill', (payload) => payload.targetId === target.id, 12000, 'warden kill');
  const rewardWaiter = once(operative.socket, 'players', (players) => (players[operative.id]?.xp || 0) > 0, 12000, 'kill xp');

  // Re-aim at the warden's latest reported position as it moves.
  let latest = { x: target.x, y: target.y };
  let self = { x: target.x - 140, y: target.y };
  operative.socket.on('ai', (payload) => { if (payload[target.id] && payload[target.id].hp > 0) latest = payload[target.id]; });
  operative.socket.on('players', (payload) => { if (payload[operative.id]) self = payload[operative.id]; });

  const handle = setInterval(() => {
    operative.socket.emit('player:attack', { x: latest.x - self.x, y: latest.y - self.y });
  }, 500);
  t.after(() => clearInterval(handle));

  const kill = await killWaiter;
  clearInterval(handle);
  assert.equal(kill.sourceId, operative.id, 'the operative is credited for the kill');
  assert.ok(kill.xp > 0, 'the kill is worth XP');
  const rewarded = await rewardWaiter;
  assert.ok(rewarded[operative.id].xp >= kill.xp, 'XP lands on the operative');
  assert.ok(rewarded[operative.id].skillPoints > 0, 'kills grant skill points');
});

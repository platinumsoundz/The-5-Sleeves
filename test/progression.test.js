import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { io } from 'socket.io-client';
import { TEST_PROFILE_FILE } from '../tools/profile-scratch.js';

const require = createRequire(import.meta.url);
const { MAX_LEVEL, xpForLevel, levelFromXp, totalXpForLevel } = require('../server/progression.js');

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PORT = 3129;
const url = `http://127.0.0.1:${PORT}`;

test('the first level costs 120 XP and each level after costs 60 more', () => {
  assert.equal(xpForLevel(1), 120);
  assert.equal(xpForLevel(2), 180);
  assert.equal(xpForLevel(3), 240);
  assert.equal(xpForLevel(0), 120, 'levels are clamped to at least 1');
  assert.equal(xpForLevel(999), xpForLevel(MAX_LEVEL), 'levels above the cap clamp to it');
});

test('cumulative XP splits into level and in-level progress', () => {
  assert.deepEqual(levelFromXp(0), { level: 1, into: 0, needed: 120 });
  assert.deepEqual(levelFromXp(119), { level: 1, into: 119, needed: 120 });
  assert.deepEqual(levelFromXp(120), { level: 2, into: 0, needed: 180 });
  assert.deepEqual(levelFromXp(299), { level: 2, into: 179, needed: 180 });
  assert.deepEqual(levelFromXp(300), { level: 3, into: 0, needed: 240 });
  assert.deepEqual(levelFromXp(totalXpForLevel(5)), { level: 5, into: 0, needed: xpForLevel(5) });
});

test('progression is monotonic and capped', () => {
  let previous = 0;
  for (let xp = 0; xp <= 20000; xp += 137) {
    const { level, into } = levelFromXp(xp);
    assert.ok(level >= previous, 'levels never decrease');
    assert.ok(into >= 0 && into < xpForLevel(level));
    previous = level;
  }
  const ceiling = levelFromXp(totalXpForLevel(MAX_LEVEL) + 10 * xpForLevel(MAX_LEVEL));
  assert.equal(ceiling.level, MAX_LEVEL, 'levels stop at the cap');
});

function startServer(env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['server.js'], { cwd: root, env: { ...process.env, PROFILE_FILE: TEST_PROFILE_FILE, PORT: String(PORT), MAX_WARDENS: '0', ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
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

test('earning XP levels an operative up and grants a skill point', async (t) => {
  // XP_SCALE makes a single relay capture worth 10x, so the level-up is observed
  // in seconds instead of minutes.
  const server = await startServer({ XP_SCALE: '10' });
  t.after(() => server.kill('SIGKILL'));

  const socket = io(url, { transports: ['websocket'], forceNew: true });
  t.after(() => socket.close());
  await once(socket, 'server:welcome');
  socket.emit('player:join', 'Ascender' + Date.now().toString(36));
  const accepted = await once(socket, 'join:accepted');
  assert.equal(accepted.stats.level, 1, 'operatives start at level 1');
  assert.equal(accepted.stats.xp, 0);

  const levelWaiter = once(socket, 'level:up', (payload) => payload.level >= 2, 10000, 'level up');
  socket.emit('player:move', { x: 250, y: 180 });

  const levelUp = await levelWaiter;
  assert.equal(levelUp.playerId, accepted.playerId);
  assert.ok(levelUp.skillPoints >= 1, 'the level-up grants a skill point');
  assert.ok(levelUp.maxHp > 100, 'the level-up raises max HP');

  const state = await once(socket, 'players', (players) => (players[accepted.playerId]?.level || 0) >= 2, 8000, 'level in broadcast');
  const self = state[accepted.playerId];
  assert.equal(self.level, levelUp.level);
  assert.equal(self.maxHp, levelUp.maxHp);
  assert.ok(self.xp >= 120, 'cumulative XP is reported to the client');
  assert.ok(self.xpIntoLevel < self.xpNeeded, 'in-level progress stays inside the level');
  assert.ok(self.xpNeeded > 0);
});

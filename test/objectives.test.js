import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { io } from 'socket.io-client';
import { TEST_PROFILE_FILE } from '../tools/profile-scratch.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PORT = 3128;
const url = `http://127.0.0.1:${PORT}`;

// Wardens are disabled for these tests so the capture maths is not disturbed by
// drones wandering onto a relay (or shooting the operatives standing on one).
function startServer(env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['server.js'], { cwd: root, env: { ...process.env, PROFILE_FILE: TEST_PROFILE_FILE, PORT: String(PORT), MAX_WARDENS: '0', ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
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

async function connect(name, color) {
  const socket = io(url, { transports: ['websocket'], forceNew: true });
  await once(socket, 'server:welcome');
  socket.emit('player:join', name);
  const accepted = await once(socket, 'join:accepted');
  if (color) socket.emit('player:color', color);
  return { socket, id: accepted.playerId };
}

const waitFor = (socket, predicate, timeout = 5000, label = 'objectives') => once(socket, 'objectives', predicate, timeout, label);

test('relays are captured by presence and fought over by rival factions', async (t) => {
  const server = await startServer();
  const sockets = [];
  t.after(() => { sockets.forEach((socket) => socket.close()); server.kill('SIGKILL'); });

  const suffix = Date.now().toString(36);
  const one = await connect('HoldA' + suffix, 'wind');
  const two = await connect('HoldB' + suffix, 'wind');
  const rival = await connect('Rival' + suffix, 'fire');
  sockets.push(one.socket, two.socket, rival.socket);

  await waitFor(one.socket, (payload) => Object.keys(payload?.nodes || {}).length === 3 && payload.match?.mode === 'domination', 5000, 'three relays');

  // Operatives spawn at random; walk the rival to a far corner first so it
  // cannot spawn onto a relay and skew the capture maths below.
  rival.socket.emit('player:move', { x: 920, y: 380 });
  await once(rival.socket, 'players', (players) => players[rival.id] && Math.hypot(players[rival.id].x - 920, players[rival.id].y - 380) < 20, 6000, 'rival reaches the corner');

  // Two Wind operatives stand on the west relay: progress then ownership.
  one.socket.emit('player:move', { x: 240, y: 170 });
  two.socket.emit('player:move', { x: 262, y: 190 });
  const gaining = await waitFor(one.socket, (payload) => payload.nodes['relay-west'].progress > 0, 12000, 'capture progress');
  assert.equal(gaining.nodes['relay-west'].progressColor, 'wind', 'progress is attributed to the standing faction');
  assert.equal(gaining.nodes['relay-west'].ownerId, null, 'the relay starts neutral');

  const owned = await waitFor(one.socket, (payload) => payload.nodes['relay-west'].ownerId === 'wind', 15000, 'capture complete');
  assert.ok(owned.nodes['relay-west'].ownerColor, 'the relay reports a holder colour');
  assert.equal(owned.nodes['relay-west'].progress, 100);

  // Holding scores over time.
  const scored = await waitFor(one.socket, (payload) => (payload.scores.wind || 0) > 0, 10000, 'score accrual');
  assert.ok(scored.scores.wind > 0, 'held relays score for their faction');

  // A rival faction starting to flip a neutral relay…
  rival.socket.emit('player:move', { x: 500, y: 560 });
  await once(rival.socket, 'players', (players) => players[rival.id] && Math.hypot(players[rival.id].x - 500, players[rival.id].y - 560) < 30);
  const threatened = await waitFor(one.socket, (payload) => payload.nodes['relay-south'].progress > 0, 12000, 'rival progress');
  assert.equal(threatened.nodes['relay-south'].ownerId, null, 'the relay is still neutral');
  assert.equal(threatened.nodes['relay-south'].progressColor, 'fire', 'capture progress tracks the rival');
  assert.equal(threatened.nodes['relay-south'].contested, false, 'a lone faction is not contested');

  // …is frozen the moment a Wind operative steps in.
  two.socket.emit('player:move', { x: 512, y: 548 });
  const contested = await waitFor(one.socket, (payload) => payload.nodes['relay-south'].contested === true, 12000, 'contest');
  assert.equal(contested.nodes['relay-south'].occupants, 2);
  const frozen = contested.nodes['relay-south'].progress;
  const later = await once(one.socket, 'objectives', () => true, 3000, 'later snapshot');
  assert.equal(later.nodes['relay-south'].progress, frozen, 'contested relays do not progress');

  // The rival leaving hands the relay to Cipher; ownership outlasts the occupant.
  rival.socket.emit('player:move', { x: 900, y: 640 });
  const captured = await waitFor(one.socket, (payload) => payload.nodes['relay-south'].ownerId === 'wind', 15000, 'second capture');
  assert.equal(captured.nodes['relay-south'].ownerId, 'wind');
  two.socket.emit('player:move', { x: 900, y: 120 });
  const emptied = await waitFor(one.socket, (payload) => payload.nodes['relay-south'].occupants === 0, 10000, 'relay emptied');
  assert.equal(emptied.nodes['relay-south'].ownerId, 'wind', 'ownership is not lost when everyone walks away');
});

test('a faction that reaches the score limit wins the match', async (t) => {
  const server = await startServer({ SCORE_LIMIT: '1' });
  const sockets = [];
  t.after(() => { sockets.forEach((socket) => socket.close()); server.kill('SIGKILL'); });

  const suffix = Date.now().toString(36);
  const squad = [];
  for (let i = 0; i < 3; i += 1) squad.push(await connect('Push' + i + suffix, 'wind'));
  sockets.push(...squad.map((member) => member.socket));

  squad.forEach((member, index) => member.socket.emit('player:move', { x: 240 + index * 12, y: 170 + index * 8 }));
  const endWaiter = once(squad[0].socket, 'match:end', (result) => result.faction === 'wind', 15000, 'match end');
  const winnerWaiter = waitFor(squad[0].socket, (payload) => payload.match?.winner === 'wind', 15000, 'winner in state');
  const result = await endWaiter;
  assert.ok(result.score >= 1, 'the winning score is reported');
  const state = await winnerWaiter;
  assert.equal(state.match.winner, 'wind');
  assert.equal(state.match.scoreLimit, 1);
  assert.ok(state.scores.wind >= 1);
});

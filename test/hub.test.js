import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { io } from 'socket.io-client';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PORT = 3134;
const url = `http://127.0.0.1:${PORT}`;

function startServer(env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['server.js'], { cwd: root, env: { ...process.env, PORT: String(PORT), MAX_WARDENS: '0', ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
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

function expectNoEvent(socket, event, predicate = () => true, timeout = 500) {
  return new Promise((resolve, reject) => {
    const handler = (payload) => {
      if (!predicate(payload)) return;
      clearTimeout(timer); socket.off(event, handler);
      reject(new Error('unexpected ' + event));
    };
    const timer = setTimeout(() => { socket.off(event, handler); resolve(); }, timeout);
    socket.on(event, handler);
  });
}

async function connect(name, zone) {
  const socket = io(url, { transports: ['websocket'], forceNew: true });
  await once(socket, 'server:welcome');
  const hub = once(socket, 'hub:state');
  socket.emit('player:join', zone ? { name, zone } : name);
  const accepted = await once(socket, 'join:accepted');
  return { socket, id: accepted.playerId, hub: await hub };
}

function at(player, x, y) { return Math.abs(player.x - x) < 4 && Math.abs(player.y - y) < 4; }

test('the safe hub spawns inside a no-combat bubble with NPCs and towers', async (t) => {
  const server = await startServer();
  const players = [];
  t.after(() => { players.forEach((player) => player.socket.close()); server.kill('SIGKILL'); });

  const player = await connect('HubTester');
  players.push(player);
  const hub = player.hub;

  assert.equal(hub.mode, 'wasteland');
  assert.equal(hub.arena, false);
  assert.ok(hub.safe && hub.safe.radius > 0, 'the hub exposes a safe bubble');
  assert.deepEqual(hub.npcs.map((npc) => npc.kind).sort(), ['portal', 'portal', 'shop']);
  assert.equal(hub.towers.length, 3);

  const self = await once(player.socket, 'players', (roster) => roster[player.id] && Math.hypot(roster[player.id].x - hub.safe.x, roster[player.id].y - hub.safe.y) <= hub.safe.radius + 1, 5000, 'safe spawn');
  assert.ok(self[player.id], 'joined inside the safe ring');

  // Attacks made from inside the bubble never become projectiles.
  player.socket.emit('player:attack', { x: 1, y: 0 });
  await expectNoEvent(player.socket, 'projectiles', (roster) => Object.values(roster || {}).some((shot) => shot.ownerId === player.id), 650);

  // The shop NPC opens a real shop payload.
  player.socket.emit('player:move', { x: 395, y: 350 });
  await once(player.socket, 'players', (roster) => roster[player.id] && at(roster[player.id], 395, 350), 5000, 'shop walk');
  const shop = once(player.socket, 'shop:open');
  player.socket.emit('player:interact');
  const payload = await shop;
  assert.ok(Array.isArray(payload.items) && payload.items.length >= 1, 'shop lists stock');
  assert.ok(payload.inventory.includes('blade-standard'), 'starter gear reaches the shop');

  // Walking onto a dormant regional tower restores it.
  const unlocked = once(player.socket, 'tower:unlocked', (tower) => tower.id === 'tower-pylon', 5000, 'tower unlock');
  player.socket.emit('player:move', { x: 500, y: 118 });
  await unlocked;
});

test('hub portals reach instanced arenas and co-op disables friendly fire', async (t) => {
  const server = await startServer();
  const players = [];
  t.after(() => { players.forEach((player) => player.socket.close()); server.kill('SIGKILL'); });

  const one = await connect('ArenaOne');
  const two = await connect('ArenaTwo');
  players.push(one, two);

  const move = (socket, id, x, y) => {
    socket.emit('player:move', { x, y });
    return once(socket, 'players', (roster) => roster[id] && at(roster[id], x, y), 5000, 'arena position');
  };
  const switchTo = async (socket, zone, label) => {
    const changed = once(socket, 'zone:changed', (payload) => payload.zone?.id === zone, 5000, label);
    socket.emit('zone:switch', zone);
    return changed;
  };

  const coOp = await switchTo(one.socket, 'arena-pve', 'co-op arena');
  await switchTo(two.socket, 'arena-pve', 'co-op arena');
  assert.equal(coOp.arena, true);
  assert.equal(coOp.friendlyFire, false);
  await move(one.socket, one.id, 500, 400);
  await move(two.socket, two.id, 560, 400);

  one.socket.emit('player:attack', { x: 1, y: 0 });
  await expectNoEvent(one.socket, 'combat:hit', (hit) => hit.targetId === two.id, 900);

  const pvp = await switchTo(one.socket, 'arena-pvp', 'pvp arena');
  await switchTo(two.socket, 'arena-pvp', 'pvp arena');
  assert.equal(pvp.arena, true);
  assert.equal(pvp.friendlyFire, true);
  await move(one.socket, one.id, 500, 400);
  await move(two.socket, two.id, 560, 400);

  const hit = once(one.socket, 'combat:hit', (event) => event.targetId === two.id, 5000, 'pvp hit');
  one.socket.emit('player:attack', { x: 1, y: 0 });
  await hit;
});

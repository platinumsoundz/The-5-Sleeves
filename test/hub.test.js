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
const START_VILLAGE = 'haven-perimeter';

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

test('a safe city has a full no-combat cube, merchant and Arena Master', async (t) => {
  const server = await startServer();
  const players = [];
  t.after(() => { players.forEach((player) => player.socket.close()); server.kill('SIGKILL'); });

  const player = await connect('HubTester' + Date.now().toString(36), START_VILLAGE);
  players.push(player);
  const hub = player.hub;

  assert.equal(hub.kind, 'haven');
  assert.equal(hub.mode, 'wasteland');
  assert.equal(hub.arena, false);
  assert.ok(hub.safe, 'the city exposes a safe rectangle');
  assert.equal(hub.safe.width, 1000);
  assert.equal(hub.safe.height, 700);
  assert.equal(hub.friendlyFire, false);
  assert.deepEqual(hub.npcs.map((npc) => npc.kind).sort(), ['arena', 'shop']);
  assert.deepEqual(hub.exits, { east: 'wild-perimeter' });

  const self = await once(player.socket, 'players', (roster) => roster[player.id] && roster[player.id].x >= 0 && roster[player.id].y >= 0, 5000, 'safe spawn');
  assert.ok(self[player.id], 'joined inside the safe cube');

  // Attacks made from a city never become projectiles.
  player.socket.emit('player:attack', { x: 1, y: 0 });
  await expectNoEvent(player.socket, 'projectiles', (roster) => Object.values(roster || {}).some((shot) => shot.ownerId === player.id), 650);

  // The merchant opens a real shop and trades in credits.
  player.socket.emit('player:move', { x: 330, y: 360 });
  await once(player.socket, 'players', (roster) => roster[player.id] && at(roster[player.id], 330, 360), 5000, 'shop walk');
  const shop = once(player.socket, 'shop:open');
  player.socket.emit('player:interact');
  const payload = await shop;
  assert.ok(Array.isArray(payload.items) && payload.items.length >= 1, 'shop lists stock');
  assert.ok(payload.inventory.includes('blade-standard'), 'starter gear reaches the shop');
  assert.ok(payload.credits >= 25, 'new operatives start with credits');
  const repair = payload.items.find((item) => item.id === 'repair-kit');
  assert.ok(repair && repair.price > 0 && repair.sell > 0, 'loot has a buy and sell price');

  const bought = once(player.socket, 'shop:update', (state) => state.inventory.includes('repair-kit'), 5000, 'bought kit');
  player.socket.emit('shop:buy', { itemId: 'repair-kit' });
  const afterBuy = await bought;
  assert.equal(afterBuy.credits, payload.credits - repair.price, 'purchase spends credits');

  const sold = once(player.socket, 'shop:update', (state) => !state.inventory.includes('repair-kit'), 5000, 'sold kit');
  player.socket.emit('shop:sell', { itemId: 'repair-kit' });
  const afterSell = await sold;
  assert.equal(afterSell.credits, afterBuy.credits + repair.sell, 'selling loot pays credits back');

  // NPC interactions share a short throttle so one key press cannot open both.
  await new Promise((resolve) => setTimeout(resolve, 800));

  // The Arena Master is physically on the left side of every city.
  player.socket.emit('player:move', { x: 150, y: 360 });
  await once(player.socket, 'players', (roster) => roster[player.id] && at(roster[player.id], 150, 360), 5000, 'arena walk');
  const menu = once(player.socket, 'arena:menu');
  player.socket.emit('player:interact');
  const arenaMenu = await menu;
  assert.equal(arenaMenu.options.length, 6, 'PvP and PvE each offer three modes');
  for (const mode of ['tdm', 'domination', 'tower']) {
    assert.ok(arenaMenu.options.some((option) => option.mode === mode), mode + ' offer exists');
  }

  // Reaching a city unlock its map spawn point and prompts the next tower.
  const coast = once(player.socket, 'zone:changed', (event) => event.zone?.id === 'haven-coast', 5000, 'coast city');
  const coastHub = once(player.socket, 'hub:state', (state) => state.zoneId === 'haven-coast', 5000, 'coast hub');
  player.socket.emit('zone:switch', 'haven-coast');
  const coastZone = await coast;
  assert.equal(coastZone.zone.kind, 'haven');
  assert.equal(coastZone.zone.towerIndex, 1);
  assert.equal(coastZone.zone.exits.north, 'tower-1');
  const coastHubState = await coastHub;
  assert.ok(coastHubState.unlockedCities.includes('haven-coast'), 'city unlocked as a spawn point');
  assert.equal(coastHubState.homeCity, 'haven-coast', 'home city follows the last safe city');
});

test('hub portals reach instanced arenas and co-op disables friendly fire', async (t) => {
  const server = await startServer();
  const players = [];
  t.after(() => { players.forEach((player) => player.socket.close()); server.kill('SIGKILL'); });

  const suffix = Date.now().toString(36);
  const one = await connect('ArenaOne' + suffix, START_VILLAGE);
  const two = await connect('ArenaTwo' + suffix, START_VILLAGE);
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

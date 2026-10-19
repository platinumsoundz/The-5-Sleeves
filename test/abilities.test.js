import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { io } from 'socket.io-client';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PORT = 3126;
const url = `http://127.0.0.1:${PORT}`;

function startServer() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['server.js'], { cwd: root, env: { ...process.env, PORT: String(PORT), MAX_WARDENS: '0' }, stdio: ['ignore', 'pipe', 'pipe'] });
    const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('server boot timeout')); }, 15000);
    child.stdout.on('data', (chunk) => { if (String(chunk).includes('is running')) { clearTimeout(timer); resolve(child); } });
    child.stderr.on('data', (chunk) => process.stderr.write(chunk));
    child.on('exit', (code) => { clearTimeout(timer); reject(new Error('server exited early: ' + code)); });
  });
}

function once(socket, event, predicate = () => true, timeout = 4000, label = event) {
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


test('domain abilities resolve server-side', async (t) => {
  const server = await startServer();
  const sockets = [];
  t.after(() => { sockets.forEach((socket) => socket.close()); server.kill('SIGKILL'); });

  const suffix = Date.now().toString(36);
  const attacker = await connect('Attacker' + suffix);
  const victim = await connect('Victim' + suffix);
  sockets.push(attacker.socket, victim.socket);

  // Park both operatives in the same quiet corner, away from the Core.
  attacker.socket.emit('player:move', { x: 200, y: 200 });
  victim.socket.emit('player:move', { x: 214, y: 206 });

  await once(attacker.socket, 'players', (players) => {
    const victimState = players[victim.id];
    const attackerState = players[attacker.id];
    return victimState && attackerState && Math.hypot(victimState.x - 214, victimState.y - 206) < 24 && Math.hypot(attackerState.x - 200, attackerState.y - 200) < 24;
  });

  // Cipher: Conduit Pulse damages a nearby rival and charges the caster.
  // All three arrive in the same tick as the cast, so listen before firing.
  const burstWaiter = once(attacker.socket, 'bursts', (bursts) => Object.values(bursts).some((entry) => entry.kind === 'pulse'), 3000);
  const hitWaiter = once(attacker.socket, 'combat:hit', (payload) => payload.targetId === victim.id && payload.kind === 'pulse');
  const chargeWaiter = once(attacker.socket, 'players', (players) => players[attacker.id].coreCharge >= 19, 3000);
  attacker.socket.emit('player:ability', { x: 1, y: 0 });
  const burst = await burstWaiter;
  assert.ok(Object.values(burst).length > 0, 'pulse emits a burst for the client');
  const hit = await hitWaiter;
  assert.equal(hit.amount, 14);
  assert.equal(hit.blocked, false);
  await chargeWaiter;

  // From here on each ability is checked in isolation: park the actors at known
  // coordinates, then cast at a known aim point.
  const reposition = async (x, y) => {
    victim.socket.emit('player:move', { x, y });
    await once(attacker.socket, 'players', (players) => players[victim.id] && Math.hypot(players[victim.id].x - x, players[victim.id].y - y) < 30);
  };
  const moveSelf = async (x, y) => {
    attacker.socket.emit('player:move', { x, y });
    await once(attacker.socket, 'players', (players) => players[attacker.id] && Math.hypot(players[attacker.id].x - x, players[attacker.id].y - y) < 30);
  };

  // Water: Tide Snare leaves a lingering hazard owned by the caster.
  await reposition(200, 320);
  victim.socket.emit('player:color', 'water');
  const poolWaiter = once(victim.socket, 'effects', (effects) => Object.values(effects).some((effect) => effect.kind === 'pool'));
  victim.socket.emit('player:ability', { x: -1, y: 0 });
  const pool = await poolWaiter;
  const snare = Object.values(pool).find((effect) => effect.kind === 'pool');
  assert.ok(snare.radius > 0 && snare.expiresAt > Date.now());
  assert.equal(snare.ownerId, victim.id);
  assert.ok(snare.x < 200, 'the snare lands at the aim point ahead of the caster');

  // Earth: Bulwark spawns a destructible wall with full health.
  await reposition(240, 340);
  victim.socket.emit('player:color', 'earth');
  const wallWaiter = once(victim.socket, 'effects', (effects) => Object.values(effects).some((effect) => effect.kind === 'wall'));
  victim.socket.emit('player:ability', { x: 0, y: 1 });
  const wallEvent = await wallWaiter;
  const wall = Object.values(wallEvent).find((effect) => effect.kind === 'wall');
  assert.equal(wall.hp, wall.maxHp);
  assert.ok(wall.y > 340, 'the bulwark rises at the aim point ahead of the caster');

  // Fire: Ember Lance is an explosive projectile with a burn payload, and it
  // detonates against the bulwark instead of passing through it.
  await moveSelf(240, 200);
  await reposition(200, 560);
  attacker.socket.emit('player:color', 'fire');
  const lanceWaiter = once(attacker.socket, 'projectiles', (projectiles) => Object.values(projectiles).some((projectile) => projectile.explodes && projectile.ownerId === attacker.id));
  const absorbedWaiter = once(attacker.socket, 'bursts', (bursts) => Object.values(bursts).some((entry) => entry.kind === 'wall-hit'), 4000, 'wall-hit burst');
  const damagedWallWaiter = once(attacker.socket, 'effects', (effects) => {
    const current = Object.values(effects).find((effect) => effect.kind === 'wall');
    return current && current.hp < current.maxHp;
  }, 4000, 'damaged wall');
  attacker.socket.emit('player:ability', { x: 0, y: 1 });
  const lance = await lanceWaiter;
  const shot = Object.values(lance).find((projectile) => projectile.explodes && projectile.ownerId === attacker.id);
  assert.ok(shot.explodes.burnMs > 0, 'ember lance applies a burn');
  assert.equal(shot.explodes.burnPower, 6);
  await absorbedWaiter;
  await damagedWallWaiter;

  // Detonation: refire away from the bulwark and let the shot expire at the map
  // edge, where it detonates in a blast.
  attacker.socket.emit('player:color', 'fire');
  const detonateWaiter = once(attacker.socket, 'bursts', (bursts) => Object.values(bursts).some((entry) => entry.kind === 'blast'), 4000, 'blast burst');
  attacker.socket.emit('player:ability', { x: -1, y: 0 });
  await detonateWaiter;

  // Wind: Gale Push hastes the caster and hurls nearby rivals away.
  await moveSelf(200, 200);
  await reposition(214, 206);
  attacker.socket.emit('player:color', 'wind');
  const galeWaiter = once(attacker.socket, 'bursts', (bursts) => Object.values(bursts).some((entry) => entry.kind === 'gale'), 3000);
  const hasteWaiter = once(attacker.socket, 'players', (players) => players[attacker.id].hasteRemaining > 0, 3000);
  attacker.socket.emit('player:ability', { x: 1, y: 0 });
  await galeWaiter;
  await hasteWaiter;
  const shoved = await once(attacker.socket, 'players', (players) => Math.hypot(players[victim.id].x - 214, players[victim.id].y - 206) > 60, 3000);
  assert.ok(shoved[victim.id].x > 214, 'gale push shoves the target away from the caster');

  // Dark: Void Siphon damages and drains a nearby rival back into the caster.
  await reposition(240, 260);
  attacker.socket.emit('player:color', 'dark');
  const siphonWaiter = once(attacker.socket, 'bursts', (bursts) => Object.values(bursts).some((entry) => entry.kind === 'siphon'), 3000);
  const drainWaiter = once(attacker.socket, 'combat:hit', (payload) => payload.kind === 'siphon' && payload.targetId === victim.id);
  attacker.socket.emit('player:ability', { x: 1, y: 1 });
  await siphonWaiter;
  await drainWaiter;

  // Cooldowns gate repeat casts and tick back down.
  const readyWaiter = once(attacker.socket, 'players', (players) => players[attacker.id].abilityId === 'void-siphon', 3000);
  const state = await readyWaiter;
  assert.equal(state[attacker.id].abilityName, 'Void Siphon');
  attacker.socket.emit('player:ability', { x: 1, y: 0 });
  const gateStart = state[attacker.id].abilityCooldown;
  assert.ok(gateStart > 0, 'the siphon went on cooldown');
  const ticking = await once(attacker.socket, 'players', (players) => players[attacker.id].abilityCooldown < gateStart, 3000);
  assert.ok(ticking[attacker.id].abilityCooldown < gateStart, 'cooldown ticks down and blocks recasting');
  // Every sleeve resolves to its own signature skill (and the client is told the
  // name/short label to render).
  const expectedAbilities = {
    cipher: { name: 'Conduit Pulse', short: 'PULSE' },
    wind: { name: 'Gale Push', short: 'GALE' },
    water: { name: 'Tide Snare', short: 'SNARE' },
    fire: { name: 'Ember Lance', short: 'LANCE' },
    earth: { name: 'Bulwark Wall', short: 'WALL' },
    dark: { name: 'Void Siphon', short: 'SIPHON' }
  };
  const abilities = new Set();
  for (const [domain, expected] of Object.entries(expectedAbilities)) {
    const waiter = once(attacker.socket, 'players', (players) => players[attacker.id].abilityName === expected.name, 3000, domain + ' ability');
    attacker.socket.emit('player:color', domain);
    const snapshot = await waiter;
    const state = snapshot[attacker.id];
    assert.equal(state.abilityShort, expected.short);
    assert.ok(state.abilityCooldownMax > 0, 'the client is told the cooldown length');
    abilities.add(state.abilityId);
  }
  assert.equal(abilities.size, 6, 'each sleeve has its own ability');
});

test('downed operatives respawn after the delay', async (t) => {
  const server = await startServer();
  t.after(() => server.kill('SIGKILL'));
  const suffix = Date.now().toString(36);
  const shooter = await connect('Shooter' + suffix);
  const target = await connect('Target' + suffix);
  t.after(() => { shooter.socket.close(); target.socket.close(); });

  shooter.socket.emit('player:move', { x: 240, y: 300 });
  target.socket.emit('player:move', { x: 340, y: 300 });
  await once(shooter.socket, 'players', (players) => players[target.id] && Math.abs(players[target.id].x - 340) < 24, 8000, 'target reposition');

  const downed = once(shooter.socket, 'combat:down', (payload) => payload.targetId === target.id, 15000);
  // 5 blasts at 20 damage each, fired east into the stationary target.
  for (let i = 0; i < 6; i += 1) {
    shooter.socket.emit('player:attack', { x: 1, y: 0 });
    await new Promise((resolve) => setTimeout(resolve, 600));
  }
  const down = await downed;
  assert.equal(down.sourceId, shooter.id);

  const respawn = await once(shooter.socket, 'combat:respawn', (payload) => payload.targetId === target.id, 12000);
  assert.equal(respawn.name, down.name);
  await once(shooter.socket, 'players', (players) => players[target.id].hp > 0, 8000);
});

test('slow and haste reach the client as remaining durations', async (t) => {
  const server = await startServer();
  t.after(() => server.kill('SIGKILL'));
  const suffix = Date.now().toString(36);
  const caster = await connect('Caster' + suffix);
  const marked = await connect('Marked' + suffix);
  t.after(() => { caster.socket.close(); marked.socket.close(); });

  caster.socket.emit('player:move', { x: 700, y: 500 });
  marked.socket.emit('player:move', { x: 706, y: 502 });
  await once(caster.socket, 'players', (players) => players[marked.id] && Math.abs(players[marked.id].x - 706) < 24);

  // The caster drops the pool on top of the rival; it ticks every 250 ms and the
  // victim picks the slow up as milliseconds remaining (clock-skew safe).
  caster.socket.emit('player:color', 'water');
  const slowWaiter = once(caster.socket, 'players', (players) => players[marked.id].slowRemaining > 0, 6000);
  caster.socket.emit('player:ability', { x: 1, y: 0 });
  const slowed = await slowWaiter;
  assert.ok(slowed[marked.id].slowRemaining > 0 && slowed[marked.id].slowRemaining <= 2200);

  caster.socket.emit('player:color', 'wind');
  const hasteWaiter = once(caster.socket, 'players', (players) => players[caster.id].hasteRemaining > 0, 4000);
  caster.socket.emit('player:ability', { x: -1, y: 0 });
  const hasted = await hasteWaiter;
  assert.ok(hasted[caster.id].hasteRemaining > 0);
});

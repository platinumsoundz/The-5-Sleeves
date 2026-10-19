// Damage, deaths, respawns and status effects — shared by every zone sim.
// All events go out through sim.send so only that zone's players see them.
const { PERIMETER_MARGIN, CORE } = require('./state.js');
const { RESPAWN_DELAY, AI_RESPAWN_DELAY, WARDEN, XP_PLAYER_KILL } = require('./spec.js');

function clampToWorld(sim, entity) {
  entity.x = Math.max(PERIMETER_MARGIN, Math.min(sim.world.width - PERIMETER_MARGIN, entity.x));
  entity.y = Math.max(PERIMETER_MARGIN, Math.min(sim.world.height - PERIMETER_MARGIN, entity.y));
}

function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

function spawnBurst(sim, burst) {
  const id = 'burst-' + sim.next.burst++;
  sim.bursts[id] = { id, duration: burst.duration || 380, expiresAt: Date.now() + (burst.duration || 380), ...burst };
  return id;
}

// Damageable entities in THIS zone. Keeping the helper central means combat
// code never has to special-case wardens.
function damageableTargets(sim) {
  return [...Object.values(sim.players), ...Object.values(sim.ai)];
}

function isHostile(a, b) {
  if (!a || !b || a.id === b.id) return false;
  if (a.kind === 'ai' && b.kind === 'ai') return false;
  return true;
}

// Applies damage with shield mitigation, records the attacker and reports
// the hit so clients can play impact feedback.
function damageTarget(sim, target, amount, source, kind = 'hit', options = {}) {
  if (!target || target.hp <= 0 || amount <= 0) return 0;
  const now = Date.now();
  const shielded = now < (target.shieldUntil || 0);
  const dealt = shielded ? amount * 0.4 : amount;
  target.hp = Math.max(0, target.hp - dealt);
  if (source && source.id) target.lastHitBy = source.id;
  if (options.announce !== false) {
    sim.send('combat:hit', { targetId: target.id, sourceId: source?.id || null, x: target.x, y: target.y, amount: Math.round(dealt), blocked: shielded, kind, hp: target.hp, maxHp: target.maxHp });
  }
  if (target.hp <= 0) handleDown(sim, target, source);
  return dealt;
}

function handleDown(sim, target, source) {
  const now = Date.now();
  if (target.kind === 'ai') {
    // Wardens drop loot instead of respawning instantly.
    target.hp = 0;
    target.respawnAt = now + AI_RESPAWN_DELAY;
    target.targetId = null;
    sim.send('combat:kill', { targetId: target.id, name: target.name, sourceId: source?.id || null, sourceName: source?.name || null, x: target.x, y: target.y, xp: target.xp || WARDEN.xp });
    const killer = source && sim.players[source.id];
    if (killer) {
      killer.skillPoints += WARDEN.skillPoints;
      killer.coreCharge = Math.min(99.99, killer.coreCharge + WARDEN.coreCharge);
      sim.host.applyXp(killer, target.xp || WARDEN.xp);
      sim.host.awardNearbyParty(killer);
    }
    return;
  }
  target.respawnAt = now + RESPAWN_DELAY;
  target.lastAttackAt = now; target.lastDashAt = now; target.lastShieldAt = now; target.lastAbilityAt = now;
  target.burnUntil = 0; target.slowUntil = 0; target.speedUntil = 0;
  sim.send('combat:down', { targetId: target.id, name: target.name, sourceId: source?.id || null, sourceName: source?.name || null, x: target.x, y: target.y });
  if (source && source.id && sim.players[source.id]) {
    const killer = sim.players[source.id];
    killer.kills = (killer.kills || 0) + 1;
    if (killer.id !== target.id) sim.host.applyXp(killer, XP_PLAYER_KILL);
  }
  if (sim.players[target.id]) sim.players[target.id].deaths = (sim.players[target.id].deaths || 0) + 1;
}

function respawnPlayer(sim, player) {
  player.hp = Math.max(1, Math.round(player.maxHp * 0.6));
  // Spawn away from the Core so players are not dropped straight back into it.
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const x = PERIMETER_MARGIN + 60 + Math.random() * (sim.world.width - PERIMETER_MARGIN * 2 - 120);
    const y = PERIMETER_MARGIN + 60 + Math.random() * (sim.world.height - PERIMETER_MARGIN * 2 - 120);
    if (distance({ x, y }, CORE) < CORE.radius + 130) continue;
    player.x = x; player.y = y; break;
  }
  player.respawnAt = 0;
  sim.host.playerSockets[player.id]?.emit('player:position', { x: player.x, y: player.y });
  sim.send('combat:respawn', { targetId: player.id, name: player.name });
}

function applySlow(target, durationMs) {
  target.slowUntil = Math.max(target.slowUntil || 0, Date.now() + durationMs);
}

function applyHaste(target, durationMs) {
  target.speedUntil = Math.max(target.speedUntil || 0, Date.now() + durationMs);
}

function applyBurn(target, source, durationMs, power) {
  target.burnUntil = Math.max(target.burnUntil || 0, Date.now() + durationMs);
  target.burnPower = power;
  target.burnSourceId = source?.id || null;
}

function knockback(sim, target, fromX, fromY, force) {
  const dx = target.x - fromX, dy = target.y - fromY;
  const length = Math.hypot(dx, dy);
  // A target standing on top of the source still needs a nudge in some direction.
  const nx = length > 0.001 ? dx / length : 1;
  const ny = length > 0.001 ? dy / length : 0;
  const falloff = Math.max(0.25, Math.min(1, length / 40));
  target.x += nx * force * falloff;
  target.y += ny * force * falloff;
  clampToWorld(sim, target);
  if (sim.players[target.id]) sim.host.playerSockets[target.id]?.emit('player:position', { x: target.x, y: target.y });
}

// Fast projectiles can step past a target between ticks, so collisions test
// the swept path (segment) rather than the end-of-tick point.
function distanceToSegment(point, fromX, fromY, toX, toY) {
  const dx = toX - fromX, dy = toY - fromY;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared < 0.0001) return distance(point, { x: toX, y: toY });
  let t = ((point.x - fromX) * dx + (point.y - fromY) * dy) / lengthSquared;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(point.x - (fromX + dx * t), point.y - (fromY + dy * t));
}

module.exports = {
  clampToWorld, distance, spawnBurst, damageableTargets, isHostile,
  damageTarget, handleDown, respawnPlayer,
  applySlow, applyHaste, applyBurn, knockback, distanceToSegment
};

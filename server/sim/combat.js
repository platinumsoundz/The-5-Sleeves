// Damage, deaths, respawns and status effects — shared by every zone sim.
// All events go out through sim.send so only that zone's players see them.
const { PERIMETER_MARGIN, CORE } = require('./state.js');
const { RESPAWN_DELAY, AI_RESPAWN_DELAY, WARDEN, XP_PLAYER_KILL, CREDITS_PLAYER_KILL } = require('./spec.js');
const { lootForTier } = require('../shop-catalog.js');

function clampToWorld(sim, entity) {
  entity.x = Math.max(PERIMETER_MARGIN, Math.min(sim.world.width - PERIMETER_MARGIN, entity.x));
  entity.y = Math.max(PERIMETER_MARGIN, Math.min(sim.world.height - PERIMETER_MARGIN, entity.y));
}

function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

// Safe zones are rectangles for cities (the entire cube) and can still be a
// circle for small camps. Both shapes block damage to operatives inside.
function inSafeZone(sim, entity) {
  if (!sim || !sim.safe || !entity) return false;
  const safe = sim.safe;
  if (Number.isFinite(safe.width) && Number.isFinite(safe.height)) {
    return entity.x >= safe.x && entity.x <= safe.x + safe.width
      && entity.y >= safe.y && entity.y <= safe.y + safe.height;
  }
  return distance(entity, safe) <= safe.radius;
}

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

function isHostile(a, b, sim) {
  if (!a || !b || a.id === b.id) return false;
  if (a.kind === 'ai' && b.kind === 'ai') return false;
  // Operatives never hurt squad mates, and co-op arenas disable PvP entirely.
  if (a.kind !== 'ai' && b.kind !== 'ai' && sim) {
    if (sim.friendlyFire === false) return false;
    // PvP arenas split arrivals into red/blue teams; team mates cannot hit
    // each other even though the room allows open combat.
    if (sim.arena && sim.alignment === 'pvp' && a.arenaTeam && b.arenaTeam && a.arenaTeam === b.arenaTeam) return false;
    if (typeof sim.host?.sameParty === 'function' && sim.host.sameParty(a.id, b.id)) return false;
  }
  return true;
}

// Applies damage with shield mitigation, records the attacker and reports
// the hit so clients can play impact feedback.
function damageTarget(sim, target, amount, source, kind = 'hit', options = {}) {
  if (!target || target.hp <= 0 || amount <= 0) return 0;
  // The starting hub is a hard no-combat bubble for players (wardens can still
  // be damaged outside it).
  if (target.kind !== 'ai' && inSafeZone(sim, target)) return 0;
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
    // Wave rooms remove the body; open-world wardens respawn later.
    target.hp = 0;
    target.targetId = null;
    if (sim.kind === 'tower') {
      delete sim.ai[target.id];
    } else {
      target.respawnAt = now + AI_RESPAWN_DELAY;
    }
    sim.send('combat:kill', { targetId: target.id, name: target.name, sourceId: source?.id || null, sourceName: source?.name || null, x: target.x, y: target.y, xp: target.xp || WARDEN.xp });
    const killer = source && sim.players[source.id];
    if (killer) {
      killer.skillPoints += target.skillPoints ?? WARDEN.skillPoints;
      killer.coreCharge = Math.min(99.99, killer.coreCharge + (target.coreCharge ?? WARDEN.coreCharge));
      killer.credits = (killer.credits || 0) + (target.credits || 0);
      sim.host.applyXp(killer, target.xp || WARDEN.xp);
      sim.host.awardNearbyParty(killer);
      const drop = lootForTier(target.tier || 1);
      if (drop) {
        killer.inventory = killer.inventory || [];
        killer.inventory.push(drop.id);
        sim.host.playerSockets[killer.id]?.emit('hub:notice', target.name + ' dropped ' + drop.name + '. Sell it at any merchant.');
      }
      if (target.credits) sim.host.playerSockets[killer.id]?.emit('hub:notice', '+' + target.credits + ' credits salvaged.');
      sim.host.persistPlayer(killer);
      if (sim.arena && sim.arenaMode === 'tdm' && sim.alignment === 'pve') {
        sim.factionScores['co-op'] = (sim.factionScores['co-op'] || 0) + 1;
      }
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
    if (killer.id !== target.id) {
      sim.host.applyXp(killer, XP_PLAYER_KILL);
      killer.credits = (killer.credits || 0) + CREDITS_PLAYER_KILL;
      sim.host.persistPlayer(killer);
    }
    if (sim.arena && sim.arenaMode === 'tdm') {
      const faction = sim.alignment === 'pve' ? 'co-op' : (killer.arenaTeam || killer.energyColor);
      sim.factionScores[faction] = (sim.factionScores[faction] || 0) + 1;
    }
  }
  if (sim.players[target.id]) sim.players[target.id].deaths = (sim.players[target.id].deaths || 0) + 1;
}

function respawnPlayer(sim, player) {
  player.hp = Math.max(1, Math.round(player.maxHp * 0.6));
  player.respawnAt = 0;
  // Death sends an operative back to the last safe city they reached. That is
  // also what makes arena and tower deaths a real return trip.
  if (sim.kind !== 'haven' && player.homeCity && typeof sim.host.travel === 'function') {
    sim.send('combat:respawn', { targetId: player.id, name: player.name });
    sim.host.travel(player, player.homeCity, 'center');
    return;
  }
  if (sim.spawn) {
    player.x = sim.spawn.x;
    player.y = sim.spawn.y;
  } else {
    for (let attempt = 0; attempt < 24; attempt += 1) {
      const x = PERIMETER_MARGIN + 60 + Math.random() * (sim.world.width - PERIMETER_MARGIN * 2 - 120);
      const y = PERIMETER_MARGIN + 60 + Math.random() * (sim.world.height - PERIMETER_MARGIN * 2 - 120);
      if (distance({ x, y }, CORE) < CORE.radius + 130) continue;
      player.x = x; player.y = y; break;
    }
  }
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
  // The hub is a hard bubble: even utility casts cannot shove an operative
  // standing inside it.
  if (target.kind !== 'ai' && inSafeZone(sim, target)) return;
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
  clampToWorld, distance, inSafeZone, spawnBurst, damageableTargets, isHostile,
  damageTarget, handleDown, respawnPlayer,
  applySlow, applyHaste, applyBurn, knockback, distanceToSegment
};

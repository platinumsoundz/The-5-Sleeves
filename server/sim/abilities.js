// The six signature sleeve abilities, resolved server-side. One ability per
// domain; `kind` decides how the cast resolves, everything else is tuning.
const { distance, damageTarget, damageableTargets, isHostile, inSafeZone, applySlow, applyHaste, applyBurn, knockback, spawnBurst } = require('./combat.js');

const DOMAIN_ABILITIES = {
  cipher: { id: 'conduit-pulse', name: 'Conduit Pulse', short: 'PULSE', cooldown: 6000, kind: 'pulse', radius: 135, damage: 14, knockback: 70, charge: 20 },
  wind: { id: 'gale-push', name: 'Gale Push', short: 'GALE', cooldown: 5200, kind: 'gale', radius: 125, damage: 8, knockback: 215, hasteMs: 1600 },
  water: { id: 'tide-snare', name: 'Tide Snare', short: 'SNARE', cooldown: 7000, kind: 'pool', cast: 95, radius: 110, duration: 3600, tickDamage: 5, slowMs: 2200 },
  fire: { id: 'ember-lance', name: 'Ember Lance', short: 'LANCE', cooldown: 5200, kind: 'lance', damage: 16, speed: 430, burnMs: 2600, burnPower: 6, blast: 75, blastDamage: 10 },
  earth: { id: 'bulwark', name: 'Bulwark Wall', short: 'WALL', cooldown: 9000, kind: 'wall', cast: 78, duration: 5200, wallHp: 140, radius: 38 },
  dark: { id: 'void-siphon', name: 'Void Siphon', short: 'SIPHON', cooldown: 8000, kind: 'siphon', radius: 155, damage: 12, drain: 0.6 }
};

function abilityFor(player) { return DOMAIN_ABILITIES[player?.energyColor] || DOMAIN_ABILITIES.cipher; }

// Every ability resolves here. `aim` is a unit vector, `origin` the caster.
function castAbility(sim, player, aim) {
  const ability = abilityFor(player);
  const now = Date.now();
  const origin = { x: player.x, y: player.y };
  if (ability.kind === 'pulse' || ability.kind === 'gale' || ability.kind === 'siphon') {
    let drained = 0;
    for (const target of damageableTargets(sim)) {
      if (!isHostile(player, target, sim) || target.id === player.id || target.hp <= 0) continue;
      if (target.kind !== 'ai' && inSafeZone(sim, target)) continue;
      if (distance(origin, target) > ability.radius) continue;
      const dealt = damageTarget(sim, target, ability.damage, player, ability.kind);
      if (ability.kind === 'siphon' && dealt) drained += dealt * ability.drain;
      if (ability.knockback) knockback(sim, target, player.x, player.y, ability.knockback);
      if (ability.kind === 'siphon' && target.hp > 0) applySlow(target, 700);
    }
    if (ability.charge) player.coreCharge = Math.min(99.99, player.coreCharge + ability.charge);
    if (ability.hasteMs) applyHaste(player, ability.hasteMs);
    if (drained > 0) player.hp = Math.min(player.maxHp, player.hp + Math.round(drained));
    spawnBurst(sim, { kind: ability.kind, x: player.x, y: player.y, radius: ability.radius, color: player.color, accentColor: player.accentColor });
    return;
  }
  const margin = 40;
  const castX = Math.max(margin, Math.min(sim.world.width - margin, player.x + aim.x * ability.cast));
  const castY = Math.max(margin, Math.min(sim.world.height - margin, player.y + aim.y * ability.cast));
  if (ability.kind === 'pool') {
    const id = 'effect-' + sim.next.effect++;
    sim.effects[id] = {
      id, kind: 'pool', ownerId: player.id, x: castX, y: castY, radius: ability.radius,
      damage: ability.tickDamage, slowMs: ability.slowMs,
      color: player.color, accentColor: player.accentColor, createdAt: now, expiresAt: now + ability.duration, nextTickAt: now
    };
    spawnBurst(sim, { kind: 'pool-burst', x: castX, y: castY, radius: ability.radius, color: player.color, accentColor: player.accentColor });
    return;
  }
  if (ability.kind === 'wall') {
    const id = 'effect-' + sim.next.effect++;
    sim.effects[id] = {
      id, kind: 'wall', ownerId: player.id, x: castX, y: castY, radius: ability.radius,
      hp: ability.wallHp, maxHp: ability.wallHp, color: player.color, accentColor: player.accentColor,
      createdAt: now, expiresAt: now + ability.duration
    };
    spawnBurst(sim, { kind: 'wall-burst', x: castX, y: castY, radius: ability.radius + 14, color: player.color, accentColor: player.accentColor });
    return;
  }
  if (ability.kind === 'lance') {
    const id = String(sim.next.projectile++);
    sim.projectiles[id] = {
      id, ownerId: player.id, x: player.x + aim.x * 22, y: player.y + aim.y * 22,
      vx: aim.x * ability.speed, vy: aim.y * ability.speed, radius: 11,
      expiresAt: now + 1400, color: player.color, accentColor: player.accentColor,
      explodes: { radius: ability.blast, damage: ability.blastDamage, burnMs: ability.burnMs, burnPower: ability.burnPower }
    };
  }
}

function explodeProjectile(sim, projectile, owner) {
  const spec = projectile.explodes;
  const source = owner || { id: projectile.ownerId, kind: 'player' };
  spawnBurst(sim, { kind: 'blast', x: projectile.x, y: projectile.y, radius: spec.radius, color: projectile.color, accentColor: projectile.accentColor });
  for (const target of damageableTargets(sim)) {
    if (target.id === projectile.ownerId || target.hp <= 0) continue;
    if (!isHostile(source, target, sim)) continue;
    if (target.kind !== 'ai' && inSafeZone(sim, target)) continue;
    if (distance(target, projectile) > spec.radius) continue;
    damageTarget(sim, target, spec.damage, owner, 'blast');
    if (spec.burnMs && target.hp > 0) applyBurn(target, owner, spec.burnMs, spec.burnPower);
  }
}

module.exports = { DOMAIN_ABILITIES, abilityFor, castAbility, explodeProjectile };

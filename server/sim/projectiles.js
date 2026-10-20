// Projectile stepping: movement, wall absorption, swept-path hits, expiry.
// Ember Lances explode on impact; warden shots are plain tracers.
const { distance, distanceToSegment, damageTarget, damageableTargets, isHostile, inSafeZone, spawnBurst } = require('./combat.js');
const { explodeProjectile } = require('./abilities.js');

function stepProjectiles(sim, now, deltaSeconds) {
  for (const [id, projectile] of Object.entries(sim.projectiles)) {
    const fromX = projectile.x, fromY = projectile.y;
    projectile.x += projectile.vx * deltaSeconds;
    projectile.y += projectile.vy * deltaSeconds;
    const owner = sim.players[projectile.ownerId] || sim.ai[projectile.ownerId] || null;
    let absorbed = false;
    for (const wall of Object.values(sim.effects)) {
      if (wall.kind !== 'wall' || wall.ownerId === projectile.ownerId) continue;
      if (distanceToSegment(wall, fromX, fromY, projectile.x, projectile.y) > wall.radius + (projectile.radius || 8)) continue;
      wall.hp -= projectile.damage || 20;
      spawnBurst(sim, { kind: 'wall-hit', x: projectile.x, y: projectile.y, radius: 26, color: wall.color, accentColor: wall.accentColor });
      if (wall.hp <= 0) delete sim.effects[wall.id];
      delete sim.projectiles[id];
      absorbed = true;
      break;
    }
    if (absorbed) continue;
    let hit = false;
    for (const target of damageableTargets(sim)) {
      if (target.id === projectile.ownerId || target.hp <= 0) continue;
      if (!isHostile(owner || { id: projectile.ownerId, kind: 'player' }, target, sim)) continue;
      if (target.kind !== 'ai' && inSafeZone(sim, target)) continue;
      if (distanceToSegment(target, fromX, fromY, projectile.x, projectile.y) > 21 + (target.radius || 0)) continue;
      damageTarget(sim, target, projectile.damage || 20 + 3 * (owner?.atk || 0), owner, 'blast');
      if (projectile.explodes) explodeProjectile(sim, projectile, owner);
      delete sim.projectiles[id];
      hit = true;
      break;
    }
    if (hit) continue;
    const expired = now > projectile.expiresAt || projectile.x < 0 || projectile.x > sim.world.width || projectile.y < 0 || projectile.y > sim.world.height;
    if (!expired) continue;
    if (projectile.explodes) explodeProjectile(sim, projectile, owner);
    delete sim.projectiles[id];
  }
}

module.exports = { stepProjectiles };

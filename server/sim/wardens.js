// PvE: Rust Wardens — patrolling defence drones (canon: dormant tower
// network defence). Wild roads scale them by danger tier; tower rooms spawn
// controlled waves through spawnWarden(sim, { x, y, tier }).
const { WARDEN, WARDEN_SCALING } = require('./spec.js');
const { clampToWorld, distance, inSafeZone, spawnBurst } = require('./combat.js');
const { CORE, PERIMETER_MARGIN } = require('./state.js');

function wardenSpawnPoint(sim) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const x = PERIMETER_MARGIN + 80 + Math.random() * (sim.world.width - PERIMETER_MARGIN * 2 - 160);
    const y = PERIMETER_MARGIN + 80 + Math.random() * (sim.world.height - PERIMETER_MARGIN * 2 - 160);
    if (distance({ x, y }, CORE) < CORE.radius + 120) continue;
    if (inSafeZone(sim, { x, y })) continue;
    if (Object.values(sim.players).some((candidate) => distance(candidate, { x, y }) < 220)) continue;
    return { x, y };
  }
  return { x: sim.world.width - PERIMETER_MARGIN - 80, y: sim.world.height - PERIMETER_MARGIN - 80 };
}

function scaledStats(tier) {
  const step = Math.max(0, (Number(tier) || 1) - 1);
  return {
    hp: Math.round(WARDEN.hp * (1 + step * WARDEN_SCALING.hpPerTier)),
    damage: Math.round(WARDEN.damage * (1 + step * WARDEN_SCALING.damagePerTier)),
    speed: WARDEN.speed * (1 + step * WARDEN_SCALING.speedPerTier),
    aggro: WARDEN.aggro + step * WARDEN_SCALING.aggroPerTier,
    attackRange: WARDEN.attackRange + step * WARDEN_SCALING.rangePerTier,
    xp: Math.round(WARDEN.xp * (1 + step * WARDEN_SCALING.xpPerTier)),
    credits: Math.round(WARDEN.credits * (1 + step * WARDEN_SCALING.creditsPerTier)),
    level: Math.max(1, Math.round(tier))
  };
}

function spawnWarden(sim, options = {}) {
  const id = 'warden-' + sim.next.warden++;
  const spot = Number.isFinite(options.x) && Number.isFinite(options.y) ? { x: options.x, y: options.y } : wardenSpawnPoint(sim);
  const tier = options.tier || sim.danger || 1;
  const stats = scaledStats(tier);
  const warden = {
    id,
    kind: 'ai',
    name: WARDEN.name,
    tier,
    level: stats.level,
    x: spot.x,
    y: spot.y,
    homeX: spot.x,
    homeY: spot.y,
    wanderX: spot.x,
    wanderY: spot.y,
    nextWanderAt: 0,
    lastShotAt: 0,
    targetId: null,
    respawnAt: 0,
    facing: 1,
    hp: stats.hp,
    maxHp: stats.hp,
    damage: stats.damage,
    speed: stats.speed,
    aggro: stats.aggro,
    attackRange: stats.attackRange,
    xp: stats.xp,
    credits: stats.credits,
    radius: WARDEN.radius,
    color: '#c98b3a',
    accentColor: '#ffd9a0'
  };
  sim.ai[id] = warden;
  return warden;
}

function nearestPlayer(sim, entity, radius) {
  let best = null, bestDistance = radius;
  for (const player of Object.values(sim.players)) {
    if (player.hp <= 0) continue;
    if (inSafeZone(sim, player)) continue;
    const away = distance(entity, player);
    if (away < bestDistance) { bestDistance = away; best = player; }
  }
  return best;
}

function fireWardenShot(sim, warden, target, now) {
  const angle = Math.atan2(target.y - warden.y, target.x - warden.x) + (Math.random() - 0.5) * 0.12;
  const id = String(sim.next.projectile++);
  sim.projectiles[id] = {
    id,
    ownerId: warden.id,
    hostile: true,
    x: warden.x + Math.cos(angle) * 20,
    y: warden.y + Math.sin(angle) * 20,
    vx: Math.cos(angle) * WARDEN.projectileSpeed,
    vy: Math.sin(angle) * WARDEN.projectileSpeed,
    radius: 7,
    damage: warden.damage || WARDEN.damage,
    expiresAt: now + 1800,
    color: '#ffb266',
    accentColor: '#ffe0b0'
  };
  spawnBurst(sim, { kind: 'muzzle', x: warden.x, y: warden.y, radius: 24, color: '#ffb266', accentColor: '#ffe0b0', duration: 220, expiresAt: now + 220 });
}

function respawnWarden(sim, warden) {
  const spot = wardenSpawnPoint(sim);
  warden.x = spot.x; warden.y = spot.y;
  warden.homeX = spot.x; warden.homeY = spot.y;
  warden.wanderX = spot.x; warden.wanderY = spot.y;
  warden.hp = warden.maxHp; warden.respawnAt = 0;
  warden.targetId = null; warden.lastShotAt = 0; warden.nextWanderAt = 0;
}

function updateWardens(sim, now, deltaSeconds) {
  for (const warden of Object.values(sim.ai)) {
    if (warden.hp <= 0) {
      if (now >= (warden.respawnAt || 0)) respawnWarden(sim, warden);
      continue;
    }
    const target = nearestPlayer(sim, warden, warden.aggro || WARDEN.aggro);
    warden.targetId = target ? target.id : null;
    let moveX = 0, moveY = 0;
    if (target) {
      const dx = target.x - warden.x, dy = target.y - warden.y;
      const away = Math.hypot(dx, dy) || 1;
      if (away > (warden.attackRange || WARDEN.attackRange) * 0.55) { moveX = dx / away; moveY = dy / away; }
      if (away <= (warden.attackRange || WARDEN.attackRange) && now - warden.lastShotAt >= WARDEN.shotCooldown) {
        warden.lastShotAt = now;
        fireWardenShot(sim, warden, target, now);
      }
    } else {
      if (now >= warden.nextWanderAt) {
        warden.nextWanderAt = now + 2500 + Math.random() * 2600;
        warden.wanderX = warden.homeX + (Math.random() - 0.5) * 240;
        warden.wanderY = warden.homeY + (Math.random() - 0.5) * 240;
      }
      const dx = warden.wanderX - warden.x, dy = warden.wanderY - warden.y;
      const away = Math.hypot(dx, dy);
      if (away > 14) { moveX = dx / away; moveY = dy / away; }
    }
    if (moveX || moveY) {
      warden.x += moveX * (warden.speed || WARDEN.speed) * deltaSeconds;
      warden.y += moveY * (warden.speed || WARDEN.speed) * deltaSeconds;
      if (Math.abs(moveX) > 0.05) warden.facing = moveX < 0 ? -1 : 1;
      clampToWorld(sim, warden);
    }
  }
}

module.exports = { spawnWarden, updateWardens, scaledStats };

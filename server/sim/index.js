// One zone's full simulation step. server.js runs this for every zone on
// each tick; zones with no members skip broadcasting but keep stepping
// (cheap: an empty zone has only wardens and echoes to move).
const { distance, damageTarget, respawnPlayer, damageableTargets, isHostile, inSafeZone, applySlow } = require('./combat.js');
const { updateWardens } = require('./wardens.js');
const { updateObjectives } = require('./objectives.js');
const { stepProjectiles } = require('./projectiles.js');
const { spawnArchiveEcho, collectArchiveEchoes, MAX_ARCHIVE_ECHOES } = require('./echoes.js');
const { abilityFor } = require('./abilities.js');
const { CORE } = require('./state.js');
const { XP_CORE_POINT } = require('./spec.js');

function stepZone(sim, now, deltaSeconds) {
  let echoesChanged = false;
  for (const player of Object.values(sim.players)) {
    const ability = abilityFor(player);
    player.abilityId = ability.id;
    player.abilityName = ability.name;
    player.abilityShort = ability.short;
    player.abilityCooldown = Math.max(0, player.lastAbilityAt + ability.cooldown - now);
    player.abilityCooldownMax = ability.cooldown;
    player.slowRemaining = Math.max(0, player.slowUntil - now);
    player.hasteRemaining = Math.max(0, player.speedUntil - now);
    player.burnRemaining = Math.max(0, player.burnUntil - now);
    sim.host.refreshLevelFields(player);

    if (player.hp <= 0) {
      player.inCore = false;
      player.coreCharge = Math.max(0, player.coreCharge - deltaSeconds * 10);
      if (player.respawnAt && now >= player.respawnAt) respawnPlayer(sim, player);
      continue;
    }
    player.inCore = distance(player, CORE) <= CORE.radius;
    if (collectArchiveEchoes(sim, player)) echoesChanged = true;
    if (now < player.burnUntil) {
      damageTarget(sim, player, (player.burnPower || 0) * deltaSeconds, sim.players[player.burnSourceId], 'burn', { announce: false });
      if (player.hp <= 0) continue;
    }
    if (player.inCore) {
      player.coreCharge += deltaSeconds * 25;
      if (player.coreCharge >= 100) {
        player.coreCharge -= 100;
        player.corePoints += 1;
        player.skillPoints += 1;
        sim.host.applyXp(player, XP_CORE_POINT);
        sim.host.awardNearbyParty(player);
      }
    } else {
      player.coreCharge = Math.max(0, player.coreCharge - deltaSeconds * 10);
    }
  }

  // Hostile wardens patrol, chase and shoot.
  updateWardens(sim, now, deltaSeconds);

  // Domination relays flip to whoever stands on them uncontested.
  updateObjectives(sim, now, deltaSeconds);

  // Lingering abilities: water pools tick damage/slow, earth walls soak shots.
  for (const [id, effect] of Object.entries(sim.effects)) {
    if (now > effect.expiresAt) { delete sim.effects[id]; continue; }
    if (effect.kind !== 'pool') continue;
    if (now < effect.nextTickAt) continue;
    effect.nextTickAt = now + 250;
    const source = sim.players[effect.ownerId] || { id: effect.ownerId, kind: 'player' };
    for (const target of damageableTargets(sim)) {
      if (!isHostile(source, target, sim) || target.hp <= 0) continue;
      if (target.kind !== 'ai' && inSafeZone(sim, target)) continue;
      if (distance(target, effect) > effect.radius) continue;
      damageTarget(sim, target, effect.damage, source, 'pool');
      if (effect.slowMs) applySlow(target, effect.slowMs);
    }
  }

  stepProjectiles(sim, now, deltaSeconds);

  for (const [id, burst] of Object.entries(sim.bursts)) if (now > burst.expiresAt) delete sim.bursts[id];

  if (echoesChanged) sim.send('archive:echoes', sim.echoes);
  // Snapshots are broadcast by the host on its own cadence (BROADCAST_MS),
  // decoupled from the simulation step; see server.js.
}

function seedZone(sim) {
  for (let i = 0; i < MAX_ARCHIVE_ECHOES; i += 1) spawnArchiveEcho(sim);
}

module.exports = { stepZone, seedZone };

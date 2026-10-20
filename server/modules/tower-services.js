// Tower rooms: three waves of scaled Rust Wardens, then the tower is marked
// complete for everyone inside. Clearing a city's tower opens its east road.
const { spawnWarden } = require('../sim/wardens.js');
const { TOWER_WAVES, TOWER_WAVE_SIZE, XP_TOWER_CLEAR, CREDITS_TOWER_CLEAR } = require('../sim/spec.js');
const { markIntroSeen } = require('./cipher-companion-memory.js');

function freshRun(zone) {
  return {
    state: 'idle', wave: 0, waves: TOWER_WAVES, enemies: 0,
    nextWaveAt: 0, clearedAt: 0, towerIndex: zone.towerIndex
  };
}

function publish(zone, extra = {}) {
  zone.send('tower:state', { ...(zone.towerRun || freshRun(zone)), ...extra, zoneId: zone.id, name: zone.tower?.name });
}

function aliveEnemies(zone) {
  return Object.values(zone.ai).filter((warden) => warden.hp > 0).length;
}

function spawnWave(zone, wave) {
  const tower = zone.tower || { x: 500, y: 260 };
  const count = TOWER_WAVE_SIZE + Math.floor((wave - 1) / 2);
  for (let i = 0; i < count; i += 1) {
    const angle = (Math.PI * 2 * i) / count + wave * 0.37;
    const radius = 145 + (i % 3) * 34;
    const x = Math.max(70, Math.min(zone.world.width - 70, tower.x + Math.cos(angle) * radius));
    const y = Math.max(80, Math.min(zone.world.height - 90, tower.y + Math.sin(angle) * radius));
    spawnWarden(zone, { x, y, tier: zone.danger || zone.towerIndex || 1 });
  }
}

function clearTower(ctx, zone, now) {
  const run = zone.towerRun;
  if (!run || run.state === 'cleared') return;
  run.state = 'cleared';
  run.clearedAt = now;
  run.enemies = 0;
  const rewardCredits = CREDITS_TOWER_CLEAR + (zone.towerIndex || 1) * 40;
  for (const player of Object.values(zone.players)) {
    if (player.hp <= 0) continue;
    player.towers = player.towers || {};
    player.towers[zone.towerIndex] = true;
    player.credits = (player.credits || 0) + rewardCredits;
    player.skillPoints = (player.skillPoints || 0) + 1;
    ctx.applyXp(player, XP_TOWER_CLEAR + (zone.towerIndex || 1) * 20);
    const cipherIntro = markIntroSeen(player);
    ctx.persistPlayer(player);
    ctx.playerSockets()[player.id]?.emit('tower:cleared', {
      index: zone.towerIndex, name: zone.tower?.name || zone.name,
      credits: rewardCredits, unlockedCities: player.unlockedCities, towers: player.towers,
      cipherIntro,
      cipherTowerClear: true
    });
  }
  zone.send('hub:notice', (zone.tower?.name || 'Tower') + ' is online. The east road is open.');
  publish(zone);
}

module.exports = {
  name: 'tower-services',
  summary: 'Tower wave encounters, completion rewards and city-road unlocks.',
  priority: 30,
  setup(ctx) {
    ctx.on('zoneChanged', (player, socket) => {
      const zone = ctx.playerZone(player.id);
      if (zone?.kind !== 'tower') return;
      // A cleared room is per-operative progression: a newcomer who has not
      // earned this tower restarts the run so they cannot be locked out.
      if (zone.towerRun?.state === 'cleared' && !player.towers?.[zone.towerIndex]) {
        zone.towerRun = freshRun(zone);
        for (const warden of Object.values(zone.ai)) delete zone.ai[warden.id];
      }
      socket.emit('tower:state', { ...(zone.towerRun || freshRun(zone)), zoneId: zone.id, name: zone.tower?.name });
    });

    ctx.on('tick', (zone, now) => {
      if (zone.kind !== 'tower') return;
      if (!zone.towerRun) zone.towerRun = freshRun(zone);
      const run = zone.towerRun;
      const players = Object.values(zone.players).filter((player) => player.hp > 0);
      if (!players.length) {
        if (run.state !== 'idle') {
          zone.towerRun = freshRun(zone);
          publish(zone);
        }
        // Clear stragglers so an empty room does not keep stale bodies.
        for (const warden of Object.values(zone.ai)) delete zone.ai[warden.id];
        return;
      }

      if (run.state === 'idle') {
        run.state = 'starting';
        run.wave = 0;
        run.nextWaveAt = now + 2200;
        run.enemies = 0;
        publish(zone);
        zone.send('hub:notice', (zone.tower?.name || 'The tower') + ' wakes. Three waves incoming.');
        return;
      }

      if (run.state === 'starting') {
        if (now < run.nextWaveAt) return;
        run.wave = 1;
        run.state = 'active';
        spawnWave(zone, run.wave);
        run.enemies = aliveEnemies(zone);
        publish(zone);
        return;
      }

      if (run.state === 'active') {
        const enemies = aliveEnemies(zone);
        if (run.enemies !== enemies) {
          run.enemies = enemies;
          publish(zone);
        }
        if (enemies > 0) {
          run.nextWaveAt = 0;
          return;
        }
        if (!run.nextWaveAt) run.nextWaveAt = now + 1800;
        if (now < run.nextWaveAt) return;
        if (run.wave >= run.waves) {
          clearTower(ctx, zone, now);
          return;
        }
        run.wave += 1;
        run.nextWaveAt = 0;
        spawnWave(zone, run.wave);
        run.enemies = aliveEnemies(zone);
        publish(zone);
      }
    });
  }
};

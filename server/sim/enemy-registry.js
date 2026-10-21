// Shared spawn/update entry points let zones work with catalogued enemy types.
const { ENEMY_CATALOG } = require('../content/enemies.js');
const { spawnPatrolShooter, updatePatrolShooters } = require('./wardens.js');
const { MAX_WILD_ENEMIES } = require('./spec.js');

const BEHAVIORS = Object.freeze({
  'patrol-shooter': Object.freeze({ spawn: spawnPatrolShooter, update: updatePatrolShooters })
});

function spawnEnemy(sim, enemyId, options = {}) {
  const definition = ENEMY_CATALOG[enemyId];
  if (!definition) throw new Error('Unknown enemy type: ' + enemyId);
  const behavior = BEHAVIORS[definition.behavior];
  if (!behavior) throw new Error('No enemy behavior registered: ' + definition.behavior);
  // The per-road ceiling is shared by every catalogued enemy family.
  if (sim.kind === 'wild' && Object.keys(sim.ai || {}).length >= MAX_WILD_ENEMIES) return null;
  return behavior.spawn(sim, options, definition);
}

function updateEnemies(sim, now, deltaSeconds) {
  const behaviorIds = new Set(Object.values(ENEMY_CATALOG).map((enemy) => enemy.behavior));
  for (const behaviorId of behaviorIds) {
    const behavior = BEHAVIORS[behaviorId];
    if (!behavior) throw new Error('No enemy behavior registered: ' + behaviorId);
    behavior.update(sim, now, deltaSeconds);
  }
}

module.exports = { spawnEnemy, updateEnemies, BEHAVIORS };

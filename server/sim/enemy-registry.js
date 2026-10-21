// Shared spawn/update entry points let zones work with catalogued enemy types.
const { ENEMY_CATALOG } = require('../content/enemies.js');
const { spawnWarden, updateWardens } = require('./wardens.js');

const BEHAVIORS = Object.freeze({
  'warden-patrol-shooter': Object.freeze({ spawn: spawnWarden, update: updateWardens })
});

function spawnEnemy(sim, enemyId, options = {}) {
  const definition = ENEMY_CATALOG[enemyId];
  if (!definition) throw new Error('Unknown enemy type: ' + enemyId);
  const behavior = BEHAVIORS[definition.behavior];
  if (!behavior) throw new Error('No enemy behavior registered: ' + definition.behavior);
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

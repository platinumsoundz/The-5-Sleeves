// Server mirror of the branching sleeve skill tree. Cost rises with depth
// (tier N costs N points); the client draws the same layout
// from public/src/config.js. Bonuses are deliberately light so combat balance
// stays predictable, but every node has a real, measurable effect.
const SKILL_TREE = Object.freeze([
  { id: 'conduit-root', name: 'Conduit Attunement', branch: 'Conduit', cost: 1, x: 50, y: 88, requires: [], desc: 'All sleeve abilities recharge 10% faster.' },
  { id: 'pulse-focus', name: 'Pulse Focus', branch: 'Conduit', cost: 2, x: 24, y: 68, requires: ['conduit-root'], desc: 'Conduit Pulse radius +20 and damage +2.' },
  { id: 'pulse-echo', name: 'Resonant Echo', branch: 'Conduit', cost: 3, x: 12, y: 46, requires: ['pulse-focus'], desc: 'Conduit Pulse also slows caught enemies for 1.4s.' },
  { id: 'gale-thread', name: 'Gale Thread', branch: 'Wind', cost: 2, x: 50, y: 60, requires: ['conduit-root'], desc: 'Dash cooldown reduced by 18%.' },
  { id: 'gale-crown', name: 'Storm Crown', branch: 'Wind', cost: 3, x: 50, y: 34, requires: ['gale-thread'], desc: 'Gale Push radius +25 and damage +3.' },
  { id: 'void-step', name: 'Void Step', branch: 'Void', cost: 4, x: 50, y: 10, requires: ['gale-crown'], desc: 'Dash travels 34 units farther.' },
  { id: 'ward-plate', name: 'Ward Plating', branch: 'Earth', cost: 2, x: 76, y: 68, requires: ['conduit-root'], desc: 'Bulwark walls gain +60 wall HP.' },
  { id: 'ward-bastion', name: 'Bastion Seal', branch: 'Earth', cost: 3, x: 88, y: 46, requires: ['ward-plate'], desc: 'Bulwark walls last 1.8s longer and mend nearby allies.' }
]);

const SKILL_BY_ID = Object.freeze(Object.fromEntries(SKILL_TREE.map((node) => [node.id, node])));

function skillById(id) {
  return typeof id === 'string' ? SKILL_BY_ID[id] || null : null;
}

// Turns unlocked node ids into tuning numbers. Read once per ability/dash so a
// freshly unlocked node takes effect on the very next cast.
function skillBonuses(player) {
  const skills = player?.skills && typeof player.skills === 'object' ? player.skills : {};
  const has = (id) => !!skills[id];
  return {
    abilityCooldownScale: has('conduit-root') ? 0.9 : 1,
    pulseRadius: has('pulse-focus') ? 20 : 0,
    pulseDamage: has('pulse-focus') ? 2 : 0,
    pulseSlowMs: has('pulse-echo') ? 1400 : 0,
    dashCooldownScale: has('gale-thread') ? 0.82 : 1,
    galeRadius: has('gale-crown') ? 25 : 0,
    galeDamage: has('gale-crown') ? 3 : 0,
    dashDistance: has('void-step') ? 34 : 0,
    wallHp: has('ward-plate') ? 60 : 0,
    wallDuration: has('ward-bastion') ? 1800 : 0,
    wallHeal: has('ward-bastion')
  };
}

module.exports = { SKILL_TREE, skillById, skillBonuses };

// Server mirror of the branching sleeve skill tree. Each node costs one skill
// point and needs its parent unlocked first; the client draws the same layout
// from public/src/config.js. Effects are intentionally light (the tree is a
// progression showcase) so combat balance stays predictable.
const SKILL_TREE = Object.freeze([
  { id: 'conduit-root', name: 'Conduit Attunement', branch: 'Conduit', cost: 1, x: 50, y: 88, requires: [], desc: 'Open a second channel through the sleeve.' },
  { id: 'pulse-focus', name: 'Pulse Focus', branch: 'Conduit', cost: 1, x: 24, y: 68, requires: ['conduit-root'], desc: 'Tighten Conduit Pulse into a cleaner wave.' },
  { id: 'pulse-echo', name: 'Resonant Echo', branch: 'Conduit', cost: 1, x: 12, y: 46, requires: ['pulse-focus'], desc: 'Pulse energy lingers for a heartbeat.' },
  { id: 'gale-thread', name: 'Gale Thread', branch: 'Wind', cost: 1, x: 50, y: 60, requires: ['conduit-root'], desc: 'Thread a tailwind behind every dash.' },
  { id: 'gale-crown', name: 'Storm Crown', branch: 'Wind', cost: 1, x: 50, y: 34, requires: ['gale-thread'], desc: 'Gale Push reaches farther across open ground.' },
  { id: 'void-step', name: 'Void Step', branch: 'Void', cost: 1, x: 50, y: 10, requires: ['gale-crown'], desc: 'Slip briefly out of phase while dashing.' },
  { id: 'ward-plate', name: 'Ward Plating', branch: 'Earth', cost: 1, x: 76, y: 68, requires: ['conduit-root'], desc: 'Bulwark walls gain an extra layer of stone.' },
  { id: 'ward-bastion', name: 'Bastion Seal', branch: 'Earth', cost: 1, x: 88, y: 46, requires: ['ward-plate'], desc: 'Held ground slowly repairs nearby allies.' }
]);

const SKILL_BY_ID = Object.freeze(Object.fromEntries(SKILL_TREE.map((node) => [node.id, node])));

function skillById(id) {
  return typeof id === 'string' ? SKILL_BY_ID[id] || null : null;
}

module.exports = { SKILL_TREE, skillById };

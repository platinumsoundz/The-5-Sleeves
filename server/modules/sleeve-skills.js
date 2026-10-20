// Sleeve skill tree: spends skill points on branching active/passive nodes.
// Validation lives here so the client tree is only a view of server truth.
const { skillById } = require('../skill-tree.js');

module.exports = {
  name: 'sleeve-skills',
  summary: 'Branching skill tree with server-validated skill point unlocks.',
  priority: 30,
  setup(ctx) {
    ctx.on('joining', (player, profile) => {
      player.skills = profile.skills && typeof profile.skills === 'object' && !Array.isArray(profile.skills)
        ? { ...profile.skills }
        : {};
    });
    ctx.on('persist', (player, record) => { record.skills = player.skills || {}; });

    ctx.registerSocket('player:skill', (player, payload, socket) => {
      const node = skillById(payload?.nodeId);
      if (!player || !node) return;
      player.skills = player.skills || {};
      if (player.skills[node.id]) { socket.emit('skill:error', 'That node is already unlocked.'); return; }
      if ((player.skillPoints || 0) < node.cost) { socket.emit('skill:error', 'Not enough skill points.'); return; }
      if (!node.requires.every((required) => player.skills[required])) {
        socket.emit('skill:error', 'Unlock the preceding node first.');
        return;
      }
      player.skillPoints -= node.cost;
      player.skills[node.id] = true;
      ctx.persistPlayer(player);
      socket.emit('skill:update', { nodeId: node.id, name: node.name, skills: player.skills, skillPoints: player.skillPoints });
      ctx.playerZone(player.id)?.broadcast();
    });
  }
};

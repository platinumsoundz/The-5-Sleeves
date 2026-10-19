// Domination mode: three relays captured by standing on them, one score
// per second per held relay, first to the score limit wins the hold.
// Each zone runs its own match (scores reset with the zone).
const { SLEEVE_COLORS, XP_CAPTURE } = require('./spec.js');
const { distance } = require('./combat.js');
const { MATCH_RESET_DELAY, resetObjectives } = require('./state.js');

const OBJECTIVE_CAPTURE_RATE = 20;
const OBJECTIVE_SCORE_RATE = 1;

function updateObjectives(sim, now, deltaSeconds) {
  const present = {};
  for (const node of Object.values(sim.objectives)) { present[node.id] = {}; node.occupants = 0; }

  for (const player of Object.values(sim.players)) {
    if (player.hp <= 0) continue;
    for (const node of Object.values(sim.objectives)) {
      if (distance(player, node) > node.radius) continue;
      const faction = player.energyColor;
      present[node.id][faction] = (present[node.id][faction] || 0) + 1;
      node.occupants += 1;
    }
  }

  for (const node of Object.values(sim.objectives)) {
    const factions = Object.keys(present[node.id]);
    node.contested = factions.length > 1;
    if (factions.length === 1) {
      const faction = factions[0];
      if (node.ownerId === faction) {
        node.progress = 100;
        node.progressColor = faction;
      } else {
        if (node.progressColor !== faction) { node.progressColor = faction; node.progress = 0; }
        node.progress = Math.min(100, node.progress + OBJECTIVE_CAPTURE_RATE * deltaSeconds * present[node.id][faction]);
        if (node.progress >= 100) {
          node.ownerId = faction;
          node.ownerColor = SLEEVE_COLORS[faction] || '#8ce0ff';
          for (const player of Object.values(sim.players)) {
            if (player.energyColor !== faction || player.hp <= 0) continue;
            player.coreCharge = Math.min(99.99, player.coreCharge + 6);
            sim.host.applyXp(player, XP_CAPTURE);
          }
          sim.send('objectives:captured', { nodeId: node.id, name: node.name, faction, color: node.ownerColor, xp: XP_CAPTURE });
        }
      }
    } else if (factions.length === 0 && !node.ownerId) {
      node.progress = Math.max(0, node.progress - OBJECTIVE_CAPTURE_RATE * 0.5 * deltaSeconds);
    }
  }

  for (const node of Object.values(sim.objectives)) {
    if (!node.ownerId) continue;
    sim.factionScores[node.ownerId] = (sim.factionScores[node.ownerId] || 0) + OBJECTIVE_SCORE_RATE * deltaSeconds;
  }

  if (sim.matchState.winner) {
    if (now - sim.matchState.endedAt >= MATCH_RESET_DELAY) {
      resetObjectives(sim);
      sim.send('match:reset', { message: 'The tower recalibrates. Next hold wins.' });
    }
  } else {
    for (const [faction, score] of Object.entries(sim.factionScores)) {
      if (score < sim.matchState.scoreLimit) continue;
      sim.matchState.winner = faction;
      sim.matchState.endedAt = now;
      sim.send('match:end', { faction, color: SLEEVE_COLORS[faction] || '#8ce0ff', score: Math.floor(score) });
      break;
    }
  }
}

module.exports = { updateObjectives };

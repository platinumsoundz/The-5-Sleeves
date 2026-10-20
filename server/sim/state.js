// Per-zone simulation state. One of these exists per world zone (city, wild
// road, tower room or arena); every simulation function in server/sim/* reads
// and mutates it. Host services (profiles, XP, parties) live in server.js and
// arrive via `host` so the simulation never touches global maps directly.

const WORLD = { width: 1000, height: 700 };
const PERIMETER_MARGIN = 40;
const CORE = { x: WORLD.width / 2, y: WORLD.height / 2, radius: 90 };

const OBJECTIVE_RADIUS = 95;
const MATCH_RESET_DELAY = 12000;
const OBJECTIVE_SPOTS = [
  { id: 'relay-west', name: 'West Relay', x: 250, y: 180 },
  { id: 'relay-east', name: 'East Relay', x: 750, y: 180 },
  { id: 'relay-south', name: 'South Relay', x: 500, y: 560 }
];
const TOWER_SPOT = { id: 'relay-tower', name: 'Central Tower', x: 500, y: 350 };

function objectiveSpotsFor(sim) {
  if (sim.kind === 'haven' || sim.kind === 'tower') return [];
  if (sim.arenaMode === 'tdm') return [];
  if (sim.arenaMode === 'tower') return [TOWER_SPOT];
  return OBJECTIVE_SPOTS;
}

function resetObjectives(sim) {
  sim.objectives = {};
  for (const spot of objectiveSpotsFor(sim)) {
    sim.objectives[spot.id] = {
      ...spot, radius: OBJECTIVE_RADIUS, ownerId: null, ownerColor: null,
      progress: 0, progressColor: null, contested: false, occupants: 0
    };
  }
  sim.factionScores = {};
  sim.matchState = {
    mode: sim.arenaMode || 'domination',
    scoreLimit: sim.scoreLimit,
    winner: null,
    endedAt: 0
  };
}

function createSimulation(catalogZone, host) {
  const kind = catalogZone.kind || (catalogZone.arena ? 'arena' : 'wild');
  const sim = {
    id: catalogZone.id,
    name: catalogZone.name,
    book: catalogZone.book,
    spirit: catalogZone.spirit,
    tint: catalogZone.tint,
    biome: catalogZone.biome || 'wasteland',
    terminals: catalogZone.terminals || [],
    world: catalogZone.world ? { ...catalogZone.world } : { ...WORLD },
    core: CORE,
    host,
    kind,
    order: catalogZone.order,
    danger: catalogZone.danger || 0,
    levelBand: catalogZone.levelBand || null,
    arena: !!catalogZone.arena,
    arenaMode: catalogZone.arenaMode || null,
    alignment: catalogZone.alignment || null,
    mode: catalogZone.mode || 'wasteland',
    friendlyFire: catalogZone.friendlyFire !== false,
    safe: catalogZone.safe ? { ...catalogZone.safe } : null,
    spawn: catalogZone.spawn ? { ...catalogZone.spawn } : { x: 500, y: 460 },
    exits: { ...(catalogZone.exits || {}) },
    npcs: (catalogZone.npcs || []).map((npc) => ({ ...npc })),
    bossSites: (catalogZone.bossSites || []).map((site) => ({ ...site })),
    towers: [],
    towerIndex: catalogZone.towerIndex || null,
    towerName: catalogZone.towerName || null,
    havenId: catalogZone.havenId || null,
    tower: catalogZone.tower ? { ...catalogZone.tower } : null,
    towerRun: null,
    players: {},
    ai: {},
    projectiles: {},
    effects: {},
    bursts: {},
    echoes: {},
    memberCount: 0,
    scoreLimit: catalogZone.scoreLimit || host.scoreLimit,
    next: { echo: 1, effect: 1, burst: 1, projectile: 1, warden: 1 },
    // Zone-scoped broadcast: only operatives inside this zone hear it.
    send(event, payload) {
      host.io.to('zone:' + sim.id).emit(event, payload);
    },
    objectivesPayload() {
      return { nodes: sim.objectives, scores: sim.factionScores, match: sim.matchState };
    },
    broadcast() {
      if (!sim.memberCount) return; // an empty room never needs state
      sim.send('players', sim.players);
      sim.send('ai', sim.ai);
      sim.send('projectiles', sim.projectiles);
      sim.send('effects', sim.effects);
      sim.send('bursts', sim.bursts);
      sim.send('objectives', sim.objectivesPayload());
    }
  };
  resetObjectives(sim);
  return sim;
}

module.exports = { WORLD, PERIMETER_MARGIN, CORE, createSimulation, resetObjectives, OBJECTIVE_SPOTS, MATCH_RESET_DELAY, TOWER_SPOT };

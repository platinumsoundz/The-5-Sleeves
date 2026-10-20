// World catalogue: a linear adventure chain built from canon regions.
//
//   First Village -> Wilds -> City (Tower 1) -> Wilds -> City (Tower 2) ...
//
// Every haven is a full safe cube with a merchant and an Arena Master. Wilds
// are open PvP/PvE roads with zone-scaled Rust Wardens. Towers are instanced
// wave rooms reached by walking north from a city. Arenas are instanced
// minigame rooms reached by talking to the Arena Master.
//
// `kind` drives the simulation:
//   haven  - full-map safe rectangle, no wardens, no combat
//   wild   - hostile road, relays stay as optional domination objectives
//   tower  - wave encounter, no relay objectives, death returns to the city
//   arena  - team deathmatch / domination / tower capture instance
const { HUB } = require('./sim/spec.js');

const WORLD = Object.freeze({ width: 1000, height: 700 });
const SAFE_CUBE = Object.freeze({ x: 0, y: 0, width: WORLD.width, height: WORLD.height });

const TERMINALS = {
  perimeter: [
    { id: 'terminal-transit', name: 'Transit Manifest Terminal', x: 138, y: 556, log: 'Transit Manifest, Last Entry: Platform 3 evacuees were told to hold for a second train that never came. The manifest lists 214 names, and someone has crossed out the last forty-one by hand.' },
    { id: 'terminal-observatory', name: 'Observatory Console', x: 872, y: 132, log: 'Observatory Log: From the east parapet the fog reads like weather, but it keeps a rhythm. Ashley counted eleven pulses per minute and marked each one with a tally. The tally runs off the edge of the panel.' },
    { id: 'terminal-vault', name: 'Sealed Vault Interface', x: 486, y: 626, log: 'Vault Interface: Access card 09 was issued to a cipher engineer whose name has been sanded off the record. Beneath the seal, someone left a note reading: "the sleeve remembers what we delete."' }
  ],
  coast: [
    { id: 'terminal-tideline', name: 'Tideline Gauge', x: 150, y: 170, log: 'Gauge reading, recovered: the water took the coast road in the night and gave back a sound like singing. Recovery crews reported the tide answering to a name none of them had spoken aloud.' },
    { id: 'terminal-drowned-relay', name: 'Drowned Relay Housing', x: 850, y: 540, log: 'Housing note: the relay still hums three fathoms down, patient as a heartbeat. Salvage protocol says cut it loose. The last two crews who touched it swam back the wrong direction, smiling.' }
  ],
  scorched: [
    { id: 'terminal-reservoir', name: 'Reservoir Archive Node', x: 160, y: 560, log: 'Node fragment: the reservoir logs list every exile by the water they were given, not by name. Entry 88 drank deep and left handprints in the stone that the next three crews could not wash off.' },
    { id: 'terminal-caravan', name: 'Caravan Beacon', x: 840, y: 160, log: 'Beacon recording: the wastes do not kill the unprepared, they recruit them. Caravan masters pay tithe in boots and silence. Whatever walks the old tower road now, it salutes the beacon before it passes.' }
  ],
  frozen: [
    { id: 'terminal-vault-cold', name: 'Cold Vault Seal', x: 155, y: 165, log: 'Seal log: the vault keeps its heat and its dead in the same drawer. Twenty-six doors were cut into this ice; twenty-five were resealed with fresh weld. The twenty-sixth was never opened — it was answered.' },
    { id: 'terminal-forge', name: 'Extinguished Forge', x: 845, y: 545, log: 'Forge record: fire that refuses to die is not fire, it is a tenant. The last keeper banked the forge, walked out into the white, and the coals have burned the same size ever since. Nobody has evicted it.' }
  ],
  apex: [
    { id: 'terminal-rebind', name: 'Rebind Schematic Kiosk', x: 145, y: 550, log: 'Kiosk schematic, partial: five sleeves, five willing spirits, one conduit that only opens from both sides. The margin note is in two hands — one of them is a cipher engineer, the other is not a hand.' }
  ],
  citadel: [
    { id: 'terminal-gatehouse', name: 'Citadel Gatehouse Log', x: 855, y: 155, log: 'Gatehouse log, final entry: the citadel has been defending itself from inside for years. The garrison surrendered to something wearing the right uniforms, speaking the right countersigns, casting no reflection on the polished floor.' }
  ]
};

function havenNpcs(city, offset = 0) {
  return [
    { id: 'npc-arena-' + city, kind: 'arena', name: 'Arena Master ' + (offset ? 'Vex ' + offset : 'Vex'), role: 'PVP / PVE ARENAS', x: 150, y: 360, radius: 68, color: '#ff6b7a' },
    { id: 'npc-shop-' + city, kind: 'shop', name: 'Merchant ' + (offset ? 'Sable ' + offset : 'Sable'), role: 'BUY · SELL · GEAR', x: 330, y: 360, radius: 68, color: '#ffd479' }
  ];
}

function haven(config) {
  return {
    world: WORLD,
    kind: 'haven',
    safe: { ...SAFE_CUBE },
    spawn: { x: 500, y: 460 },
    mode: 'wasteland',
    friendlyFire: false,
    npcs: havenNpcs(config.slot, config.offset),
    ...config
  };
}

function wild(config) {
  return {
    world: WORLD,
    kind: 'wild',
    safe: null,
    spawn: { x: 82, y: 350 },
    mode: 'wasteland',
    friendlyFire: true,
    npcs: [],
    ...config
  };
}

function tower(config) {
  return {
    world: WORLD,
    kind: 'tower',
    safe: null,
    spawn: { x: 500, y: 610 },
    mode: 'tower',
    friendlyFire: false,
    npcs: [],
    exits: { south: config.havenId },
    tower: { x: 500, y: 260, name: config.towerName },
    ...config
  };
}

function arena(config) {
  return {
    world: WORLD,
    kind: 'arena',
    arena: true,
    safe: null,
    spawn: { x: 500, y: 520 },
    mode: 'arena-' + config.alignment,
    friendlyFire: config.alignment !== 'pve',
    npcs: [],
    terminals: [],
    biome: 'arena',
    ...config
  };
}

const ZONES = [
  haven({
    id: 'haven-perimeter',
    slot: 'perimeter',
    name: 'The Perimeter · First Village',
    book: 'Book I — The Perimeter and the First Tower',
    spirit: 'Wind',
    tint: 'rgba(80, 220, 200, 0.05)',
    biome: 'grass',
    order: 0,
    advertise: true,
    towerIndex: null,
    terminals: TERMINALS.perimeter,
    exits: { east: 'wild-perimeter' },
    desc: 'A walled village square. The only safe ground for a long way east.'
  }),

  wild({
    id: 'wild-perimeter',
    name: 'Perimeter Wilds',
    book: 'The road east',
    spirit: 'Wind',
    tint: 'rgba(80, 220, 200, 0.04)',
    biome: 'wasteland',
    order: 1,
    danger: 1,
    levelBand: [1, 4],
    terminals: [],
    exits: { west: 'haven-perimeter', east: 'haven-coast' }
  }),

  haven({
    id: 'haven-coast',
    slot: 'coast',
    offset: 1,
    name: 'The Sunken Coast · Tidehold',
    book: 'Book II — The Sunken Coast',
    spirit: 'Water',
    tint: 'rgba(70, 130, 255, 0.07)',
    biome: 'water',
    order: 2,
    towerIndex: 1,
    towerName: 'Tower 1 · Drowned Pylon',
    terminals: TERMINALS.coast,
    exits: { west: 'wild-perimeter', east: 'wild-coast', north: 'tower-1' },
    desc: 'Tidehold keeps its lanterns lit above a patient black sea.'
  }),

  wild({
    id: 'wild-coast',
    name: 'Coast Road',
    book: 'The road east',
    spirit: 'Water',
    tint: 'rgba(70, 130, 255, 0.05)',
    biome: 'wasteland',
    order: 3,
    danger: 2,
    levelBand: [5, 9],
    exits: { west: 'haven-coast', east: 'haven-scorched' }
  }),

  haven({
    id: 'haven-scorched',
    slot: 'scorched',
    offset: 2,
    name: 'The Scorched Wastes · Emberhold',
    book: 'Book III — Shadows of Exile',
    spirit: 'Earth',
    tint: 'rgba(255, 170, 80, 0.06)',
    biome: 'earth',
    order: 4,
    towerIndex: 2,
    towerName: 'Tower 2 · Ember Spire',
    terminals: TERMINALS.scorched,
    exits: { west: 'wild-coast', east: 'wild-scorched', north: 'tower-2' },
    desc: 'Emberhold is built from the bones of a refinery that never cooled.'
  }),

  wild({
    id: 'wild-scorched',
    name: 'Ash Road',
    book: 'The road east',
    spirit: 'Earth',
    tint: 'rgba(255, 170, 80, 0.05)',
    biome: 'wasteland',
    order: 5,
    danger: 3,
    levelBand: [10, 14],
    exits: { west: 'haven-scorched', east: 'haven-frozen' }
  }),

  haven({
    id: 'haven-frozen',
    slot: 'frozen',
    offset: 3,
    name: 'The Frozen Wastes · Frosthold',
    book: 'Book IV — The Frozen Wastes',
    spirit: 'Fire',
    tint: 'rgba(200, 235, 255, 0.07)',
    biome: 'fire',
    order: 6,
    towerIndex: 3,
    towerName: 'Tower 3 · White Kiln',
    terminals: TERMINALS.frozen,
    exits: { west: 'wild-scorched', east: 'wild-frozen', north: 'tower-3' },
    desc: 'Frosthold survives on banked coals and stubborn engineering.'
  }),

  wild({
    id: 'wild-frozen',
    name: 'White Road',
    book: 'The road east',
    spirit: 'Fire',
    tint: 'rgba(200, 235, 255, 0.05)',
    biome: 'wasteland',
    order: 7,
    danger: 4,
    levelBand: [15, 19],
    exits: { west: 'haven-frozen', east: 'haven-apex' }
  }),

  haven({
    id: 'haven-apex',
    slot: 'apex',
    offset: 4,
    name: 'The Apex Citadel · Lower Ward',
    book: 'Book V — The Apex Citadel',
    spirit: 'Cipher + Dark',
    tint: 'rgba(180, 90, 255, 0.06)',
    biome: 'cipher',
    order: 8,
    towerIndex: 4,
    towerName: 'Tower 4 · Rebind Bastion',
    terminals: TERMINALS.apex,
    exits: { west: 'wild-frozen', east: 'wild-apex', north: 'tower-4' },
    desc: 'The outer ward of the Citadel, kept bright to hide how deep it goes.'
  }),

  wild({
    id: 'wild-apex',
    name: 'Citadel Ascent',
    book: 'The final road',
    spirit: 'Dark',
    tint: 'rgba(180, 90, 255, 0.05)',
    biome: 'wasteland',
    order: 9,
    danger: 5,
    levelBand: [20, 25],
    exits: { west: 'haven-apex', east: 'haven-citadel' }
  }),

  haven({
    id: 'haven-citadel',
    slot: 'citadel',
    offset: 5,
    name: 'The Apex Citadel · Spire',
    book: 'Book V — The Apex Citadel',
    spirit: 'Cipher + Dark',
    tint: 'rgba(200, 120, 255, 0.08)',
    biome: 'cipher',
    order: 10,
    towerIndex: 5,
    towerName: 'Tower 5 · Apex Spire',
    terminals: TERMINALS.citadel,
    exits: { west: 'wild-apex', north: 'tower-5' },
    desc: 'The last safe floor before the final tower.'
  }),

  tower({
    id: 'tower-1', name: 'Tower 1 · Drowned Pylon', havenId: 'haven-coast', towerIndex: 1,
    order: 2, danger: 2, levelBand: [5, 9],
    book: 'Tower 1', spirit: 'Water', tint: 'rgba(70, 130, 255, 0.1)', biome: 'water'
  }),
  tower({
    id: 'tower-2', name: 'Tower 2 · Ember Spire', havenId: 'haven-scorched', towerIndex: 2,
    order: 4, danger: 4, levelBand: [10, 14],
    book: 'Tower 2', spirit: 'Earth', tint: 'rgba(255, 170, 80, 0.1)', biome: 'earth'
  }),
  tower({
    id: 'tower-3', name: 'Tower 3 · White Kiln', havenId: 'haven-frozen', towerIndex: 3,
    order: 6, danger: 6, levelBand: [15, 19],
    book: 'Tower 3', spirit: 'Fire', tint: 'rgba(200, 235, 255, 0.1)', biome: 'fire'
  }),
  tower({
    id: 'tower-4', name: 'Tower 4 · Rebind Bastion', havenId: 'haven-apex', towerIndex: 4,
    order: 8, danger: 8, levelBand: [20, 24],
    book: 'Tower 4', spirit: 'Cipher + Dark', tint: 'rgba(180, 90, 255, 0.1)', biome: 'cipher'
  }),
  tower({
    id: 'tower-5', name: 'Tower 5 · Apex Spire', havenId: 'haven-citadel', towerIndex: 5,
    order: 10, danger: 10, levelBand: [25, 30],
    book: 'Tower 5', spirit: 'Cipher + Dark', tint: 'rgba(200, 120, 255, 0.12)', biome: 'cipher'
  }),

  arena({
    id: 'arena-pvp', alignment: 'pvp', arenaMode: 'domination', scoreLimit: 180,
    name: 'Arena · PvP Domination', book: 'Arena', spirit: 'Crimson', tint: 'rgba(255, 80, 120, 0.07)'
  }),
  arena({
    id: 'arena-pvp-tdm', alignment: 'pvp', arenaMode: 'tdm', scoreLimit: 25,
    name: 'Arena · PvP Team Deathmatch', book: 'Arena', spirit: 'Crimson', tint: 'rgba(255, 80, 120, 0.07)'
  }),
  arena({
    id: 'arena-pvp-tower', alignment: 'pvp', arenaMode: 'tower', scoreLimit: 150,
    name: 'Arena · PvP Capture the Tower', book: 'Arena', spirit: 'Crimson', tint: 'rgba(255, 80, 120, 0.07)'
  }),
  arena({
    id: 'arena-pve', alignment: 'pve', arenaMode: 'domination', scoreLimit: 120,
    name: 'Arena · Co-op Domination', book: 'Arena', spirit: 'Water', tint: 'rgba(80, 190, 255, 0.07)'
  }),
  arena({
    id: 'arena-pve-tdm', alignment: 'pve', arenaMode: 'tdm', scoreLimit: 30,
    name: 'Arena · Co-op Warden Hunt', book: 'Arena', spirit: 'Water', tint: 'rgba(80, 190, 255, 0.07)'
  }),
  arena({
    id: 'arena-pve-tower', alignment: 'pve', arenaMode: 'tower', scoreLimit: 120,
    name: 'Arena · Co-op Capture the Tower', book: 'Arena', spirit: 'Water', tint: 'rgba(80, 190, 255, 0.07)'
  })
];

// Title-screen choices. The world is a journey, not a menu of unlocked cities:
// everyone starts in the First Village and unlocks the rest by travelling.
const LOBBY_ZONE_IDS = ['haven-perimeter'];
// Bare `player:join` is used by integration tests and developer tools. Keep it
// on a combat road so those low-level checks still exercise the simulation.
const DEFAULT_ZONE_ID = 'wild-perimeter';

function zoneCatalog() {
  return ZONES.map((zone) => ({
    ...zone,
    terminals: (zone.terminals || []).map((terminal) => ({ ...terminal })),
    npcs: (zone.npcs || []).map((npc) => ({ ...npc })),
    exits: { ...(zone.exits || {}) },
    safe: zone.safe ? { ...zone.safe } : null,
    spawn: zone.spawn ? { ...zone.spawn } : { ...HUB.spawn },
    tower: zone.tower ? { ...zone.tower } : null
  }));
}

function findZone(zones, zoneId) {
  return zones.find((zone) => zone.id === zoneId) || null;
}

// Client map data: everything except private arena instances.
function worldMapPayload() {
  return ZONES.filter((zone) => zone.kind !== 'arena').map((zone) => ({
    id: zone.id, name: zone.name, kind: zone.kind, order: zone.order,
    towerIndex: zone.towerIndex || null, havenId: zone.havenId || null,
    danger: zone.danger || 0, levelBand: zone.levelBand || null,
    biome: zone.biome || 'wasteland',
    exits: { ...(zone.exits || {}) }
  })).sort((a, b) => a.order - b.order || (a.kind === 'tower' ? 1 : -1));
}

module.exports = { ZONES, LOBBY_ZONE_IDS, DEFAULT_ZONE_ID, zoneCatalog, findZone, worldMapPayload, WORLD };

// Canon zone catalog (roadmap #9). Each playable zone is one book of the
// story (see memory/02-universe-canon.md and lore/). The catalogue defines
// identity and lore only — the simulation for every zone is identical.
// Terminal positions must avoid the Core (500,350 r150) and the three
// relays (250,180 / 750,180 / 500,560, r118).

const ZONES = [
  {
    id: 'the-perimeter',
    name: 'The Perimeter',
    book: 'Book I — The Perimeter and the First Tower',
    spirit: 'Wind',
    tint: 'rgba(80, 220, 200, 0.05)',
    terminals: [
      { id: 'terminal-transit', name: 'Transit Manifest Terminal', x: 138, y: 556, log: 'Transit Manifest, Last Entry: Platform 3 evacuees were told to hold for a second train that never came. The manifest lists 214 names, and someone has crossed out the last forty-one by hand.' },
      { id: 'terminal-observatory', name: 'Observatory Console', x: 872, y: 132, log: 'Observatory Log: From the east parapet the fog reads like weather, but it keeps a rhythm. Ashley counted eleven pulses per minute and marked each one with a tally. The tally runs off the edge of the panel.' },
      { id: 'terminal-vault', name: 'Sealed Vault Interface', x: 486, y: 626, log: 'Vault Interface: Access card 09 was issued to a cipher engineer whose name has been sanded off the record. Beneath the seal, someone left a note reading: "the sleeve remembers what we delete."' }
    ]
  },
  {
    id: 'sunken-coast',
    name: 'The Sunken Coast',
    book: 'Book II — The Sunken Coast',
    spirit: 'Water',
    tint: 'rgba(70, 130, 255, 0.07)',
    terminals: [
      { id: 'terminal-tideline', name: 'Tideline Gauge', x: 150, y: 170, log: 'Gauge reading, recovered: the water took the coast road in the night and gave back a sound like singing. Recovery crews reported the tide answering to a name none of them had spoken aloud.' },
      { id: 'terminal-drowned-relay', name: 'Drowned Relay Housing', x: 850, y: 540, log: 'Housing note: the relay still hums three fathoms down, patient as a heartbeat. Salvage protocol says cut it loose. The last two crews who touched it swam back the wrong direction, smiling.' }
    ]
  },
  {
    id: 'scorched-wastes',
    name: 'The Scorched Wastes',
    book: 'Book III — Shadows of Exile',
    spirit: 'Earth',
    tint: 'rgba(255, 170, 80, 0.06)',
    terminals: [
      { id: 'terminal-reservoir', name: 'Reservoir Archive Node', x: 160, y: 560, log: 'Node fragment: the reservoir logs list every exile by the water they were given, not by name. Entry 88 drank deep and left handprints in the stone that the next three crews could not wash off.' },
      { id: 'terminal-caravan', name: 'Caravan Beacon', x: 840, y: 160, log: 'Beacon recording: the wastes do not kill the unprepared, they recruit them. Caravan masters pay tithe in boots and silence. Whatever walks the old tower road now, it salutes the beacon before it passes.' }
    ]
  },
  {
    id: 'frozen-wastes',
    name: 'The Frozen Wastes',
    book: 'Book IV — The Frozen Wastes',
    spirit: 'Fire',
    tint: 'rgba(200, 235, 255, 0.07)',
    terminals: [
      { id: 'terminal-vault-cold', name: 'Cold Vault Seal', x: 155, y: 165, log: 'Seal log: the vault keeps its heat and its dead in the same drawer. Twenty-six doors were cut into this ice; twenty-five were resealed with fresh weld. The twenty-sixth was never opened — it was answered.' },
      { id: 'terminal-forge', name: 'Extinguished Forge', x: 845, y: 545, log: 'Forge record: fire that refuses to die is not fire, it is a tenant. The last keeper banked the forge, walked out into the white, and the coals have burned the same size ever since. Nobody has evicted it.' }
    ]
  },
  {
    id: 'apex-citadel',
    name: 'The Apex Citadel',
    book: 'Book V — The Apex Citadel',
    spirit: 'Cipher + Dark',
    tint: 'rgba(180, 90, 255, 0.06)',
    terminals: [
      { id: 'terminal-rebind', name: 'Rebind Schematic Kiosk', x: 145, y: 550, log: 'Kiosk schematic, partial: five sleeves, five willing spirits, one conduit that only opens from both sides. The margin note is in two hands — one of them is a cipher engineer, the other is not a hand.' },
      { id: 'terminal-gatehouse', name: 'Citadel Gatehouse Log', x: 855, y: 155, log: 'Gatehouse log, final entry: the citadel has been defending itself from inside for years. The garrison surrendered to something wearing the right uniforms, speaking the right countersigns, casting no reflection on the polished floor.' }
    ]
  }
];

const DEFAULT_ZONE_ID = 'the-perimeter';

function zoneCatalog() {
  return ZONES.map((zone) => ({ ...zone, terminals: zone.terminals.map((terminal) => ({ ...terminal })) }));
}

function findZone(zones, zoneId) {
  return zones.find((zone) => zone.id === zoneId) || null;
}

module.exports = { ZONES, DEFAULT_ZONE_ID, zoneCatalog, findZone };

// Shared combat/progression tuning for every zone simulation. One file so
// a novice can rebalance the whole game without reading the sim code.
// Env knobs keep their historical names (MAX_WARDENS, SCORE_LIMIT, XP_SCALE).

const SLEEVE_COLORS = {
  cipher: '#00ffff',
  wind: '#00ff88',
  water: '#0088ff',
  fire: '#ff4400',
  earth: '#cc7722',
  dark: '#9900ff',
  azure: '#43b9ff',
  emerald: '#45f29a',
  crimson: '#ff536b',
  violet: '#c875ff',
  'co-op': '#7dffd8',
  red: '#ff6b7a',
  blue: '#5fb8ff'
};
const SLEEVE_ACCENTS = { cipher: '#78ff5f', wind: '#a7ffd0', water: '#71d5ff', fire: '#ffb347', earth: '#f0b768', dark: '#ff29d6', azure: '#8ce0ff', emerald: '#a7ffd0', crimson: '#ffb347', violet: '#ff29d6' };
const LEGACY_DOMAINS = { cipher: 'wind', azure: 'water', emerald: 'wind', crimson: 'fire', violet: 'dark' };
// Cipher is an allied AI, not a playable faction. Legacy profiles migrate to Wind.
const ACTIVE_DOMAINS = new Set(['wind', 'water', 'fire', 'earth', 'dark']);

const RESPAWN_DELAY = 5000;
const AI_RESPAWN_DELAY = 9000;
const ABILITY_BURST_LIFETIME = 380;
const BURN_TICK_CAP = 60;

// Shared five-enemy road cap is owned by the beginner-editable balance config.
const { MAX_WILD_ENEMIES } = require('../content/region-balance.js');
// Hostile PvE drones that patrol the ruins and shoot at operatives.
const MAX_WARDENS = Number.isFinite(Number(process.env.MAX_WARDENS)) ? Math.max(0, Number(process.env.MAX_WARDENS)) : 4;
// Legacy imports use these aliases; new enemy data lives in one catalog.
const { RUST_WARDEN, SCAVENGER_DRONE } = require('../content/enemies.js');
const MAX_DRONES = Number.isFinite(Number(process.env.MAX_DRONES))
  ? Math.max(0, Number(process.env.MAX_DRONES))
  : (MAX_WARDENS > 0 ? Math.min(SCAVENGER_DRONE.spawnCount, Math.max(0, MAX_WILD_ENEMIES - MAX_WARDENS)) : 0);
const WARDEN_SCALING = RUST_WARDEN.scaling;
const WARDEN = { name: RUST_WARDEN.name, ...RUST_WARDEN.stats };

// XP and credit bounties (scaled by XP_SCALE inside applyXp).
const XP_ECHO = 15;
const XP_CORE_POINT = 25;
const XP_PLAYER_KILL = 30;
const XP_CAPTURE = 20;
const XP_TOWER = 60;
const XP_TOWER_CLEAR = 180;
const CREDITS_PLAYER_KILL = 18;
const CREDITS_TOWER_CLEAR = 150;
const LEVEL_HP_GAIN = 10;
const TOWER_WAVES = 3;
const TOWER_WAVE_SIZE = 3;

// Legacy fallback constants kept for older imports/tests. Live cities define
// their own full-map safe rectangles, NPCs and tower gates in zones-catalog.js.
const HUB = Object.freeze({
  x: 500, y: 350, radius: 112,
  spawn: Object.freeze({ x: 500, y: 455 })
});
const HUB_NPCS = Object.freeze([
  { id: 'npc-shop', kind: 'shop', name: 'Quartermaster Vale', role: 'SHOP VENDOR', x: 395, y: 350, radius: 62, color: '#ffd479' },
  { id: 'npc-pvp', kind: 'portal', targetZone: 'arena-pvp', name: 'Arena Gate · PvP', role: 'DOMINATION · FULL PVP', x: 605, y: 350, radius: 62, color: '#ff6b7a' },
  { id: 'npc-pve', kind: 'portal', targetZone: 'arena-pve', name: 'Arena Gate · Co-op', role: 'DOMINATION · NO FRIENDLY FIRE', x: 500, y: 245, radius: 62, color: '#5fd0ff' }
]);

// Legacy tower markers kept for older imports; live towers are catalog zones.
const TOWERS = Object.freeze([
  { id: 'tower-pylon', name: 'Tower 1 · Fallen Pylon', x: 500, y: 118, radius: 64 },
  { id: 'tower-parapet', name: 'Tower 2 · East Parapet', x: 872, y: 118, radius: 64 },
  { id: 'tower-transit', name: 'Tower 3 · Transit Terminus', x: 124, y: 612, radius: 64 }
]);

// Archive Echo lore lines (Tower log fragments).
const ARCHIVE_LOGS = [
  'Archive Log #04: Tower 1 atmospheric filters operating at 42% capacity...',
  'Archive Log #11: A field report notes a repeating signal beneath the eastern transit line.',
  'Archive Log #17: Perimeter fog readings exceed safe exposure limits.',
  'Archive Log #23: The Cipher Conduit responds to Sleeve resonance.',
  'Archive Log #31: Evacuation records end before the final Tower 1 lockdown.'
];

module.exports = {
  SLEEVE_COLORS, SLEEVE_ACCENTS, LEGACY_DOMAINS, ACTIVE_DOMAINS,
  RESPAWN_DELAY, AI_RESPAWN_DELAY, ABILITY_BURST_LIFETIME, BURN_TICK_CAP,
  MAX_WILD_ENEMIES, MAX_WARDENS, MAX_DRONES, WARDEN, WARDEN_SCALING,
  XP_ECHO, XP_CORE_POINT, XP_PLAYER_KILL, XP_CAPTURE, XP_TOWER, XP_TOWER_CLEAR,
  CREDITS_PLAYER_KILL, CREDITS_TOWER_CLEAR, LEVEL_HP_GAIN, TOWER_WAVES, TOWER_WAVE_SIZE,
  HUB, HUB_NPCS, TOWERS,
  ARCHIVE_LOGS
};

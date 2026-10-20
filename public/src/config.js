export const WORLD_DEFAULT = Object.freeze({ width: 1000, height: 700 });
export const CORE_DEFAULT = Object.freeze({ x: 500, y: 350, radius: 90 });
export const MOVE_SPEED = 220;
export const SEND_INTERVAL = 50;
export const PROFILE_KEY = 'the5sleeves.profile.v1';
export const TILE_SIZE = 40;
export const PERIMETER_MARGIN = 40;
export const MAX_ARCHIVE_ECHOES = 5;
export const DOMAINS = Object.freeze({
  cipher: { label: 'Cipher Sleeve', primary: '#00ffff', accent: '#78ff5f' },
  wind: { label: 'Wind Domain', primary: '#00ff88', accent: '#a7ffd0' },
  water: { label: 'Water Domain', primary: '#0088ff', accent: '#71d5ff' },
  fire: { label: 'Fire Domain', primary: '#ff4400', accent: '#ffb347' },
  earth: { label: 'Earth Domain', primary: '#cc7722', accent: '#f0b768' },
  dark: { label: 'Dark Spirit', primary: '#9900ff', accent: '#ff29d6' }
});

// Fallback safe cube for the title screen. Live cities supply the real safe
// rectangle through hub:state; wilderness and arena rooms supply null.
export const HUB = Object.freeze({
  x: 0, y: 0, width: 1000, height: 700,
  spawn: Object.freeze({ x: 500, y: 460 })
});
export const HUB_NPCS = Object.freeze([]);
export const TOWERS = Object.freeze([]);

// Mirrors server/shop-catalog.js so inventory/menu pages can render without a
// second round trip. Keep ids and sell values in step with the server.
export const SHOP_ITEMS = Object.freeze([
  { id: 'blade-standard', name: 'Standard Cipher Blade', slot: 'weapon', price: 0, sell: 2, tier: 'Starter', atkBonus: 0, desc: 'Balanced conduit blade issued to every new operative.' },
  { id: 'armor-body-basic', name: 'Perimeter Field Coat', slot: 'chest', price: 0, sell: 2, tier: 'Starter', atkBonus: 0, desc: 'Weathered coat with a stitched Cipher Core patch.' },
  { id: 'helm-scout', name: 'Scout Visor', slot: 'head', price: 40, sell: 20, tier: 'Basic', atkBonus: 1, desc: 'Cracked visor optics, still good enough to read the fogline.' },
  { id: 'legs-runner', name: 'Runner Greaves', slot: 'legs', price: 55, sell: 27, tier: 'Basic', atkBonus: 1, desc: 'Light greaves for operatives who cross the wasteland fast.' },
  { id: 'feet-transit', name: 'Transit Boots', slot: 'feet', price: 55, sell: 27, tier: 'Basic', atkBonus: 1, desc: 'Salvaged platform boots with reinforced soles.' },
  { id: 'chest-warden', name: 'Warden Plate', slot: 'chest', price: 120, sell: 60, tier: 'Field', atkBonus: 0, desc: 'Plating cut from a dormant Rust Warden shell.' },
  { id: 'blade-ember', name: 'Ember Edge', slot: 'weapon', price: 180, sell: 90, tier: 'Field', atkBonus: 4, desc: 'A hot-running blade that leaves an orange afterimage.' },
  { id: 'blade-frost', name: 'White Kiln Edge', slot: 'weapon', price: 320, sell: 160, tier: 'Rare', atkBonus: 7, desc: 'A frozen blade that rings like a struck rail.' },
  { id: 'chest-bastion', name: 'Rebind Bastion Plate', slot: 'chest', price: 400, sell: 200, tier: 'Rare', atkBonus: 0, desc: 'Citadel plate etched with a counter-conduit schematic.' },
  { id: 'blade-void', name: 'Void Reaver', slot: 'weapon', price: 520, sell: 260, tier: 'Epic', atkBonus: 11, desc: 'A dark blade that cuts a half-second after it passes.' },
  { id: 'weapon-apex', name: 'Apex Conduit Blade', slot: 'weapon', price: 900, sell: 450, tier: 'Apex', atkBonus: 16, desc: 'The last pattern the Citadel forge produced.' },
  { id: 'repair-kit', name: 'Conduit Repair Kit', slot: 'supply', price: 25, sell: 12, tier: 'Supply', atkBonus: 0, desc: 'A giftable kit of conduit seals and copper tape.' }
]);
export const ITEM_CATALOG = Object.freeze(Object.fromEntries(SHOP_ITEMS.map((item) => [item.id, item])));

// Branching skill tree; mirrors server/skill-tree.js.
export const SKILL_TREE = Object.freeze([
  { id: 'conduit-root', name: 'Conduit Attunement', branch: 'Conduit', cost: 1, x: 50, y: 88, requires: [], desc: 'Open a second channel through the sleeve.' },
  { id: 'pulse-focus', name: 'Pulse Focus', branch: 'Conduit', cost: 1, x: 24, y: 68, requires: ['conduit-root'], desc: 'Tighten Conduit Pulse into a cleaner wave.' },
  { id: 'pulse-echo', name: 'Resonant Echo', branch: 'Conduit', cost: 1, x: 12, y: 46, requires: ['pulse-focus'], desc: 'Pulse energy lingers for a heartbeat.' },
  { id: 'gale-thread', name: 'Gale Thread', branch: 'Wind', cost: 1, x: 50, y: 60, requires: ['conduit-root'], desc: 'Thread a tailwind behind every dash.' },
  { id: 'gale-crown', name: 'Storm Crown', branch: 'Wind', cost: 1, x: 50, y: 34, requires: ['gale-thread'], desc: 'Gale Push reaches farther across open ground.' },
  { id: 'void-step', name: 'Void Step', branch: 'Void', cost: 1, x: 50, y: 10, requires: ['gale-crown'], desc: 'Slip briefly out of phase while dashing.' },
  { id: 'ward-plate', name: 'Ward Plating', branch: 'Earth', cost: 1, x: 76, y: 68, requires: ['conduit-root'], desc: 'Bulwark walls gain an extra layer of stone.' },
  { id: 'ward-bastion', name: 'Bastion Seal', branch: 'Earth', cost: 1, x: 88, y: 46, requires: ['ward-plate'], desc: 'Held ground slowly repairs nearby allies.' }
]);

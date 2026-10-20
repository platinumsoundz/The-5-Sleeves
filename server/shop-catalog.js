// Merchant stock and loot. Credits are the world currency: wardens drop them,
// players earn them from kills, and every city merchant buys and sells gear.
// Equipment gives a small weapon ATK bonus; the base combat curve is unchanged.
const SELL_RATE = 0.5;

const SHOP_ITEMS = Object.freeze([
  { id: 'blade-standard', name: 'Standard Cipher Blade', slot: 'weapon', price: 0, tier: 'Starter', atkBonus: 0, tierValue: 0, desc: 'Balanced conduit blade issued to every new operative.' },
  { id: 'armor-body-basic', name: 'Perimeter Field Coat', slot: 'chest', price: 0, tier: 'Starter', atkBonus: 0, tierValue: 0, desc: 'Weathered coat with a stitched Cipher Core patch.' },
  { id: 'helm-scout', name: 'Scout Visor', slot: 'head', price: 40, tier: 'Basic', atkBonus: 1, tierValue: 1, desc: 'Cracked visor optics, still good enough to read the fogline.' },
  { id: 'legs-runner', name: 'Runner Greaves', slot: 'legs', price: 55, tier: 'Basic', atkBonus: 1, tierValue: 1, desc: 'Light greaves for operatives who cross the wasteland fast.' },
  { id: 'feet-transit', name: 'Transit Boots', slot: 'feet', price: 55, tier: 'Basic', atkBonus: 1, tierValue: 1, desc: 'Salvaged platform boots with reinforced soles.' },
  { id: 'chest-warden', name: 'Warden Plate', slot: 'chest', price: 120, tier: 'Field', atkBonus: 0, tierValue: 2, desc: 'Plating cut from a dormant Rust Warden shell.' },
  { id: 'blade-ember', name: 'Ember Edge', slot: 'weapon', price: 180, tier: 'Field', atkBonus: 4, tierValue: 2, desc: 'A hot-running blade that leaves an orange afterimage.' },
  { id: 'blade-frost', name: 'White Kiln Edge', slot: 'weapon', price: 320, tier: 'Rare', atkBonus: 7, tierValue: 3, desc: 'A frozen blade that rings like a struck rail.' },
  { id: 'chest-bastion', name: 'Rebind Bastion Plate', slot: 'chest', price: 400, tier: 'Rare', atkBonus: 0, tierValue: 3, desc: 'Citadel plate etched with a counter-conduit schematic.' },
  { id: 'blade-void', name: 'Void Reaver', slot: 'weapon', price: 520, tier: 'Epic', atkBonus: 11, tierValue: 4, desc: 'A dark blade that cuts a half-second after it passes.' },
  { id: 'weapon-apex', name: 'Apex Conduit Blade', slot: 'weapon', price: 900, tier: 'Apex', atkBonus: 16, tierValue: 5, desc: 'The last pattern the Citadel forge produced.' },
  { id: 'repair-kit', name: 'Conduit Repair Kit', slot: 'supply', price: 25, tier: 'Supply', atkBonus: 0, tierValue: 1, desc: 'A giftable kit of conduit seals and copper tape.' }
].map((item) => Object.freeze({ ...item, sell: sellPrice(item) })));

function sellPrice(item) {
  if (!item) return 0;
  if (!item.price) return 2;
  return Math.max(2, Math.floor(item.price * SELL_RATE));
}

const ITEM_CATALOG = Object.freeze(Object.fromEntries(SHOP_ITEMS.map((item) => [item.id, item])));
const DEFAULT_INVENTORY = Object.freeze(['blade-standard', 'armor-body-basic']);
const DEFAULT_EQUIPPED = Object.freeze({
  head: null,
  chest: 'armor-body-basic',
  legs: null,
  feet: null,
  weapon: 'blade-standard',
  supply: null
});

const LOOT_BY_TIER = {
  1: ['helm-scout', 'legs-runner', 'feet-transit', 'repair-kit'],
  2: ['chest-warden', 'blade-ember', 'repair-kit'],
  3: ['blade-frost', 'chest-bastion', 'blade-ember'],
  4: ['blade-void', 'chest-bastion', 'blade-frost'],
  5: ['weapon-apex', 'blade-void', 'chest-bastion']
};

function itemById(id) {
  return typeof id === 'string' ? ITEM_CATALOG[id] || null : null;
}

function gearAtkFor(equipped) {
  let bonus = 0;
  for (const id of Object.values(equipped || {})) {
    const item = itemById(id);
    if (item) bonus += item.atkBonus || 0;
  }
  return bonus;
}

function lootForTier(tier) {
  const table = LOOT_BY_TIER[Math.max(1, Math.min(5, Math.round(tier || 1)))] || LOOT_BY_TIER[1];
  if (Math.random() > 0.55) return null;
  return itemById(table[Math.floor(Math.random() * table.length)]) || null;
}

module.exports = { SHOP_ITEMS, ITEM_CATALOG, DEFAULT_INVENTORY, DEFAULT_EQUIPPED, itemById, sellPrice, gearAtkFor, lootForTier, SELL_RATE };

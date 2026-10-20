// Starter gear sold by Quartermaster Vale in the safe hub. Prices are paid in
// Core Points (the same currency earned by relay captures and echoes). Items
// are collection/visual progression for now; equipping never changes combat
// maths, so existing combat tuning stays intact.
const SHOP_ITEMS = Object.freeze([
  { id: 'blade-standard', name: 'Standard Cipher Blade', slot: 'weapon', price: 0, tier: 'Starter', desc: 'Balanced conduit blade issued to every new operative.' },
  { id: 'armor-body-basic', name: 'Perimeter Field Coat', slot: 'chest', price: 0, tier: 'Starter', desc: 'Weathered coat with a stitched Cipher Core patch.' },
  { id: 'helm-scout', name: 'Scout Visor', slot: 'head', price: 3, tier: 'Basic', desc: 'Cracked visor optics, still good enough to read the fogline.' },
  { id: 'legs-runner', name: 'Runner Greaves', slot: 'legs', price: 4, tier: 'Basic', desc: 'Light greaves for operatives who cross the wasteland fast.' },
  { id: 'feet-transit', name: 'Transit Boots', slot: 'feet', price: 4, tier: 'Basic', desc: 'Salvaged platform boots with reinforced soles.' },
  { id: 'chest-warden', name: 'Warden Plate', slot: 'chest', price: 8, tier: 'Field', desc: 'Plating cut from a dormant Rust Warden shell.' },
  { id: 'blade-ember', name: 'Ember Edge', slot: 'weapon', price: 9, tier: 'Field', desc: 'A hot-running blade that leaves an orange afterimage.' },
  { id: 'repair-kit', name: 'Conduit Repair Kit', slot: 'supply', price: 2, tier: 'Supply', desc: 'A giftable kit of conduit seals and copper tape.' }
]);

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

function itemById(id) {
  return typeof id === 'string' ? ITEM_CATALOG[id] || null : null;
}

module.exports = { SHOP_ITEMS, ITEM_CATALOG, DEFAULT_INVENTORY, DEFAULT_EQUIPPED, itemById };

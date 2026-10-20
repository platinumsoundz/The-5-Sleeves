// Personal suit colours. These are cosmetic and independent of the sleeve
// faction: the faction owns the aura/ability colour, the palette owns the
// scarf, chest strap and aura sparks. The client mirrors this list in
// public/src/config.js — keep the two in sync.
const PLAYER_PALETTES = Object.freeze([
  { id: 'ice', name: 'Ice', hex: '#7fe8ff' },
  { id: 'acid', name: 'Acid', hex: '#b6ff4d' },
  { id: 'ember', name: 'Ember', hex: '#ff9a4d' },
  { id: 'rose', name: 'Rose', hex: '#ff6f9c' },
  { id: 'violet', name: 'Violet', hex: '#c58bff' },
  { id: 'gold', name: 'Gold', hex: '#ffd86b' },
  { id: 'jade', name: 'Jade', hex: '#5effc1' },
  { id: 'bone', name: 'Bone', hex: '#e8e2cf' }
]);

const DEFAULT_PALETTE = 'ice';

// Accepts either an id ("gold") or a hex ("#ffd86b") so old profiles and
// crafted links keep working. Returns the canonical palette entry or null.
function findPalette(value) {
  if (typeof value !== 'string') return null;
  const needle = value.trim().toLowerCase();
  return PLAYER_PALETTES.find((palette) => palette.id === needle || palette.hex.toLowerCase() === needle) || null;
}

module.exports = { PLAYER_PALETTES, DEFAULT_PALETTE, findPalette };

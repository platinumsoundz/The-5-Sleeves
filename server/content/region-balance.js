// Beginner-editable regional balance settings.
// Edit this file to tune recommended levels, the shared road population cap,
// and tower difficulty without changing AI or combat algorithms.

const MAX_WILD_ENEMIES = 5;

// These bands are guidance for players, not a hard level gate.
// Keep each road and its matching tower close enough to feel like one region.
const REGION_LEVEL_BANDS = Object.freeze({
  'wild-perimeter': Object.freeze([1, 4]),
  'wild-coast': Object.freeze([5, 9]),
  'wild-scorched': Object.freeze([10, 14]),
  'wild-frozen': Object.freeze([15, 19]),
  'wild-apex': Object.freeze([20, 25]),
  'wild-eastern-expanse': Object.freeze([30, 40]),
  'tower-1': Object.freeze([5, 9]),
  'tower-2': Object.freeze([10, 14]),
  'tower-3': Object.freeze([15, 19]),
  'tower-4': Object.freeze([20, 24]),
  'tower-5': Object.freeze([25, 30])
});

// Each later tower gets more total pressure through wave count and wave size.
// "baseWaveSize" is the first wave size; later odd-numbered waves grow by one.
const TOWER_BALANCE = Object.freeze({
  1: Object.freeze({ waves: 3, baseWaveSize: 3 }),
  2: Object.freeze({ waves: 3, baseWaveSize: 3 }),
  3: Object.freeze({ waves: 4, baseWaveSize: 3 }),
  4: Object.freeze({ waves: 4, baseWaveSize: 4 }),
  5: Object.freeze({ waves: 5, baseWaveSize: 4 })
});

function levelBandFor(zoneId, fallback = null) {
  const band = REGION_LEVEL_BANDS[zoneId];
  return band ? [...band] : (Array.isArray(fallback) ? [...fallback] : null);
}

function towerBalanceFor(towerIndex) {
  return TOWER_BALANCE[towerIndex] || TOWER_BALANCE[1];
}

module.exports = {
  MAX_WILD_ENEMIES,
  REGION_LEVEL_BANDS,
  TOWER_BALANCE,
  levelBandFor,
  towerBalanceFor
};

import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  MAX_WILD_ENEMIES,
  REGION_LEVEL_BANDS,
  TOWER_BALANCE,
  levelBandFor,
  towerBalanceFor
} = require('../server/content/region-balance.js');

test('regional level guidance is centralized and returned as a safe copy', () => {
  assert.deepEqual(levelBandFor('wild-perimeter'), [1, 4]);
  assert.deepEqual(levelBandFor('tower-5'), [25, 30]);
  const band = levelBandFor('wild-coast');
  band[0] = 99;
  assert.deepEqual(REGION_LEVEL_BANDS['wild-coast'], [5, 9]);
  assert.equal(levelBandFor('unknown-zone'), null);
});

test('all wilderness enemies share the documented five-enemy ceiling', () => {
  assert.equal(MAX_WILD_ENEMIES, 5);
});

test('later tower balance budgets increase without changing the AI implementation', () => {
  assert.deepEqual(towerBalanceFor(1), { waves: 3, baseWaveSize: 3 });
  assert.deepEqual(towerBalanceFor(3), { waves: 4, baseWaveSize: 3 });
  assert.deepEqual(towerBalanceFor(5), { waves: 5, baseWaveSize: 4 });
  assert.deepEqual(towerBalanceFor(999), TOWER_BALANCE[1]);
});

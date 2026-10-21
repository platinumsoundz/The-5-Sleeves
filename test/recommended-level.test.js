import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { recommendedLevelLabel } from '../public/src/level-recommendation.js';

const require = createRequire(import.meta.url);
const { zoneCatalog } = require('../server/zones-catalog.js');

test('recommended-level labels format valid ranges and reject malformed bands', () => {
  assert.equal(recommendedLevelLabel([1, 4]), 'Recommended Level: 1–4');
  assert.equal(recommendedLevelLabel([8, 8]), 'Recommended Level: 8');
  for (const invalid of [null, [], [0, 4], [5, 4], [1, 2.5], ['1', 4]]) {
    assert.equal(recommendedLevelLabel(invalid), '');
  }
});

test('road and tower entry UI both use catalog level bands', async () => {
  const zones = new Map(zoneCatalog().map((zone) => [zone.id, zone]));
  assert.deepEqual(zones.get('wild-perimeter').levelBand, [1, 4]);
  assert.deepEqual(zones.get('tower-1').levelBand, [5, 9]);

  const [entranceUi, arrivalUi] = await Promise.all([
    readFile(new URL('../public/src/modules/hub-world.js', import.meta.url), 'utf8'),
    readFile(new URL('../public/src/uiManager.js', import.meta.url), 'utf8')
  ]);
  assert.match(entranceUi, /recommendedLevelLabel\(levelBand\)/);
  assert.match(entranceUi, /zone\.levelBand/);
  assert.match(arrivalUi, /recommendedLevelLabel\(zone\.levelBand\)/);
});

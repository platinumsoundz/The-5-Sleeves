import test from 'node:test';
import assert from 'node:assert/strict';
import { BIOMES, biomeFor, drawBiomeTile, drawBiomeBands } from '../public/src/biomes.js';
import { ZONES } from '../server/zones-catalog.js';

const WORLD = { width: 1000, height: 700 };
const EXPECTED_HAVENS = {
  'haven-perimeter': 'grass',
  'haven-coast': 'water',
  'haven-scorched': 'earth',
  'haven-frozen': 'fire',
  'haven-apex': 'cipher',
  'haven-citadel': 'cipher'
};

function fakeContext() {
  const calls = [];
  const target = {};
  const ctx = new Proxy(target, {
    get(object, prop) {
      if (prop in object) return object[prop];
      return (...args) => { calls.push({ method: prop, args }); };
    },
    set(object, prop, value) { object[prop] = value; return true; }
  });
  return { ctx, calls };
}

// The wasteland painter asks for optional art, which constructs Image in a
// browser. Node tests only need the procedural fallback.
globalThis.Image = class {
  constructor() { this.loaded = false; this.naturalWidth = 0; }
};

test('every zone declares a real biome', () => {
  for (const zone of ZONES) {
    assert.ok(BIOMES[zone.biome], zone.id + ' has a known biome');
  }
});

test('the spawn is grass, the tower cities follow canon spirits, and wilds are wasteland', () => {
  for (const [id, biome] of Object.entries(EXPECTED_HAVENS)) {
    assert.equal(ZONES.find((zone) => zone.id === id)?.biome, biome, id);
  }
  const wilds = ZONES.filter((zone) => zone.kind === 'wild');
  assert.equal(wilds.length, 6, 'the current world has six wild routes');
  assert.ok(wilds.every((zone) => zone.biome === 'wasteland'), 'every wild road shares the wasteland floor');
  for (const tower of ZONES.filter((zone) => zone.kind === 'tower')) {
    const haven = ZONES.find((zone) => zone.id === tower.havenId);
    assert.equal(tower.biome, haven?.biome, tower.id + ' matches its city');
  }
});

test('unknown biomes fall back to wasteland', () => {
  assert.equal(biomeFor('not-real').label, 'Wasteland');
  assert.equal(biomeFor(undefined).label, 'Wasteland');
});

test('every biome paints both floor and wall tiles without throwing', () => {
  for (const id of Object.keys(BIOMES)) {
    for (const isWall of [false, true]) {
      const { ctx, calls } = fakeContext();
      assert.doesNotThrow(() => drawBiomeTile(ctx, 5, 7, WORLD, isWall, id), id + ' wall=' + isWall);
      assert.ok(calls.some((call) => call.method === 'fillRect'), id + ' paints a floor');
    }
  }
});

test('biome bands darken the perimeter and draw the biome edge', () => {
  const { ctx, calls } = fakeContext();
  drawBiomeBands(ctx, WORLD, 'grass');
  assert.equal(calls.filter((call) => call.method === 'fillRect').length, 4, 'four border bands');
  assert.equal(calls.filter((call) => call.method === 'strokeRect').length, 1, 'one inner edge line');
  assert.match(ctx.strokeStyle, /143,196,110/);
});

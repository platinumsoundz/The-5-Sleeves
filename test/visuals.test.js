import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const { zoneCatalog } = require('../server/zones-catalog.js');
const { createSimulation } = require('../server/sim/state.js');

test('all regions propagate their assigned biome to the live simulation', async () => {
  const { BIOMES } = await import(pathToFileURL(path.join(root, 'public/src/biomes.js')).href);
  for (const zone of zoneCatalog()) {
    assert.ok(zone.biome in BIOMES, `${zone.id} has a known background biome`);
    const simulation = createSimulation(zone, { scoreLimit: 100 });
    assert.equal(simulation.biome, zone.biome, `${zone.id} keeps its biome at runtime`);
  }
});

test('each tower has a named landmark for its client visual', () => {
  const towers = zoneCatalog().filter((zone) => zone.kind === 'tower');
  assert.equal(towers.length, 5);
  for (const tower of towers) assert.equal(tower.tower?.name, tower.name, `${tower.id} landmark name`);
});

test('all sleeve domains, Rust Warden, and ruin tiles have baked visual assets', () => {
  const domains = ['dark', 'earth', 'fire', 'water', 'wind'];
  for (const domain of domains) {
    for (const suffix of ['', '_walk']) {
      const asset = path.join(root, 'public/assets/player_' + domain + suffix + '.png');
      assert.ok(fs.existsSync(asset), `${path.relative(root, asset)} exists`);
    }
  }
  for (const filename of ['warden.png', 'ruins_tile.png', 'ruins_tiles.png']) {
    assert.ok(fs.existsSync(path.join(root, 'public/assets', filename)), `${filename} exists`);
  }
});

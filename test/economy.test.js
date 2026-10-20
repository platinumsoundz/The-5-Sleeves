import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { SHOP_ITEMS, SALVAGE_ITEMS, SHOP_ITEM_IDS, itemById, lootForTier } = require('../server/shop-catalog.js');

test('salvage is catalogued as valuable sell-only inventory, not merchant stock', () => {
  assert.equal(SALVAGE_ITEMS.length, 2);
  for (const item of SALVAGE_ITEMS) {
    assert.ok(item.sell > 0);
    assert.equal(item.price, 0);
    assert.equal(item.slot, 'salvage');
    assert.ok(itemById(item.id), 'salvage remains resolvable for selling and persistence');
    assert.equal(SHOP_ITEM_IDS.has(item.id), false, 'cannot be bought from merchant stock');
    assert.equal(SHOP_ITEMS.some((stock) => stock.id === item.id), false);
  }
});

test('each loot tier can yield its intended sell-only salvage', () => {
  const originalRandom = Math.random;
  try {
    for (const [tier, id] of [[1, 'shattered-circuitry'], [2, 'shattered-circuitry'], [3, 'corroded-relay-parts'], [4, 'corroded-relay-parts'], [5, 'corroded-relay-parts']]) {
      const values = [0, 0.999];
      Math.random = () => values.shift() ?? 0.999;
      assert.equal(lootForTier(tier).id, id);
    }
  } finally {
    Math.random = originalRandom;
  }
});

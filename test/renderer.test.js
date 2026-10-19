import test from 'node:test';
import assert from 'node:assert/strict';
import { tileVariantFrame, sourceRectForView, buildBackground } from '../public/src/renderer.js';

const WORLD = { width: 1000, height: 700 };

test('interior tiles cycle through the four floor variants', () => {
  const seen = new Set();
  for (let ty = 0; ty < 8; ty += 1) for (let tx = 0; tx < 8; tx += 1) seen.add(tileVariantFrame(tx, ty, false));
  assert.deepEqual([...seen].sort(), [0, 1, 2, 3]);
  assert.ok([...seen].every((frame) => frame < 4));
});

test('perimeter tiles use the two cracked ring variants', () => {
  const variants = new Set();
  for (let tx = 0; tx < 6; tx += 1) variants.add(tileVariantFrame(tx, 0, true));
  assert.deepEqual([...variants].sort(), [4, 5]);
});

test('the visible source rect is clamped to the world', () => {
  const inside = sourceRectForView({ left: 100, top: 50, right: 400, bottom: 250 }, WORLD);
  assert.deepEqual(inside, { x: 100, y: 50, width: 300, height: 200 });
  const overflow = sourceRectForView({ left: -200, top: -100, right: 2000, bottom: 2000 }, WORLD);
  assert.deepEqual(overflow, { x: 0, y: 0, width: 1000, height: 700 });
});

test('an off-world view copies nothing', () => {
  const rect = sourceRectForView({ left: 1200, top: 800, right: 1400, bottom: 900 }, WORLD);
  assert.equal(rect.width, 0);
  assert.equal(rect.height, 0);
});

test('the background is baked once and every tile is drawn exactly once', () => {
  const drawn = [];
  const bands = [];
  const canvas = { getContext: () => ({ clearRect() {}, fillRect() {}, drawImage() {} }) };
  buildBackground(canvas, WORLD, (ctx, tx, ty, world, isWall) => drawn.push([tx, ty, isWall]), (_ctx, world) => bands.push(world));
  const columns = Math.ceil(1000 / 40), rows = Math.ceil(700 / 40);
  assert.equal(drawn.length, columns * rows, 'every tile is baked');
  assert.equal(new Set(drawn.map(([tx, ty]) => tx + ':' + ty)).size, drawn.length, 'no tile is baked twice');
  assert.equal(drawn.filter(([, , isWall]) => isWall).length, columns * 2 + rows * 2 - 4, 'only the ring counts as wall');
  assert.equal(bands.length, 1, 'the static perimeter bands are part of the baked canvas');
});

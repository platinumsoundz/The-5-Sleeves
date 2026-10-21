import test from 'node:test';
import assert from 'node:assert/strict';
import { tileVariantFrame, sourceRectForView, buildBackground, notificationLayout } from '../public/src/renderer.js';
import { drawEnemy } from '../public/src/enemyRenderer.js';

const WORLD = { width: 1000, height: 700 };

test('small enemies render as compact data-sized drones instead of full Warden sprites', () => {
  const rectangles = [];
  const ctx = {
    save() {}, restore() {}, translate() {}, rotate() {}, beginPath() {}, moveTo() {}, lineTo() {},
    closePath() {}, fill() {}, fillRect(x, y, width, height) { rectangles.push({ width, height }); }
  };
  drawEnemy(ctx, { size: 'small', x: 100, y: 100, radius: 8, hp: 35, maxHp: 35 }, 0);
  assert.equal(rectangles.length, 2, 'drone body and eye are drawn');
  assert.ok(rectangles[0].width < 20, 'body stays visibly smaller than the Warden hull');
});

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

test('notifications stack on the left below the minimap and mode strip', () => {
  const quiet = notificationLayout({ world: WORLD }, 900, 10000);
  const busy = notificationLayout({
    world: WORLD,
    objectives: { scores: { wind: 1, water: 2, earth: 3, fire: 4, dark: 5 } },
    killFeed: [{ at: 9500 }, { at: 9800 }]
  }, 900, 10000);
  assert.equal(quiet.x, 10, 'the anchor is the left radar edge, not screen center');
  assert.ok(quiet.y > 10 + 156 * WORLD.height / WORLD.width, 'the anchor follows the minimap');
  assert.ok(busy.y > quiet.y, 'score rows and kill notices are accounted for before new banners');
  assert.ok(busy.width <= 300, 'the notification column stays compact');
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

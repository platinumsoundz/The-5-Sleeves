import test from 'node:test';
import assert from 'node:assert/strict';
import { stickVector } from '../public/src/inputManager.js';

const close = (a, b) => Math.abs(a - b) < 1e-9;

test('the analog stick covers all 360 degrees, including diagonals', () => {
  const angles = [0, 30, 45, 90, 135, 180, 225, 270, 315];
  for (const degrees of angles) {
    const radians = degrees * Math.PI / 180;
    const vector = stickVector(Math.cos(radians) * 100, Math.sin(radians) * 100, 50);
    assert.ok(close(Math.hypot(vector.x, vector.y), 1), degrees + '° is full speed');
    assert.ok(close(vector.x, Math.cos(radians)), degrees + '° keeps its x angle');
    assert.ok(close(vector.y, Math.sin(radians)), degrees + '° keeps its y angle');
  }
});

test('a diagonal drag is not rounded to a cardinal direction', () => {
  const vector = stickVector(40, 40, 50);
  assert.ok(vector.x > 0 && vector.y > 0, 'both axes move');
  assert.ok(close(vector.x, vector.y), '45° gives an equal split');
});

test('drag distance scales speed and long drags clamp to full speed', () => {
  const half = stickVector(0, 25, 50);
  assert.ok(close(half.y, 0.5), 'half the radius is half speed');
  const far = stickVector(0, 400, 50);
  assert.ok(close(far.y, 1), 'past the radius is full speed');
  assert.ok(close(far.x, 0));
});

test('the dead zone stops jitter at rest', () => {
  assert.deepEqual(stickVector(2, 3, 50), { x: 0, y: 0 });
  assert.deepEqual(stickVector(0, 0, 50), { x: 0, y: 0 });
});

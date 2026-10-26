import test from 'node:test';
import assert from 'node:assert/strict';
import { formatRemaining } from '../public/src/modules/zone-hazards.js';

test('hazard countdown rounds up and never displays negative time', () => {
  assert.equal(formatRemaining(5000, 0), '5s');
  assert.equal(formatRemaining(5000, 4100), '1s');
  assert.equal(formatRemaining(5000, 5000), '0s');
  assert.equal(formatRemaining(5000, 7000), '0s');
});

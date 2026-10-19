import test from 'node:test';
import assert from 'node:assert/strict';
import { createTrackStore, recordSample, sampleTrack, pruneStore, INTERPOLATION_DELAY, EXTRAPOLATION_LIMIT } from '../public/src/interpolation.js';

test('blends between the two surrounding samples', () => {
  const store = createTrackStore();
  recordSample(store, 'a', 0, 0, 0);
  recordSample(store, 'a', 100, 100, 50);
  const midway = sampleTrack(store, 'a', 50);
  assert.equal(midway.x, 50);
  assert.equal(midway.y, 25);
  assert.ok(Math.abs(midway.vx - 1000) < 1e-6, 'speed is reported for animation/facing');
});

test('render delay reads into the past', () => {
  const store = createTrackStore();
  recordSample(store, 'a', 1000, 0, 0);
  recordSample(store, 'a', 1050, 55, 0);
  const sampled = sampleTrack(store, 'a', 1050 - INTERPOLATION_DELAY + (1000 - 1000));
  assert.ok(sampled.x < 55, 'a delayed sample must not be ahead of the newest snapshot');
});

test('duplicate samples refresh the timestamp instead of drifting', () => {
  const store = createTrackStore();
  recordSample(store, 'a', 0, 10, 10);
  recordSample(store, 'a', 100, 10, 10);
  assert.equal(store.entries.a.length, 1);
  assert.equal(store.entries.a[0].t, 100);
  assert.equal(sampleTrack(store, 'a', 160).x, 10);
});

test('extrapolation beyond the newest sample is capped', () => {
  const store = createTrackStore();
  recordSample(store, 'a', 0, 0, 0);
  recordSample(store, 'a', 50, 100, 0);
  const far = sampleTrack(store, 'a', 100000);
  assert.ok(Math.abs(far.x - (100 + 2000 * EXTRAPOLATION_LIMIT)) < 1e-6);
});

test('unknown ids and empty tracks return null', () => {
  const store = createTrackStore();
  assert.equal(sampleTrack(store, 'missing', 0), null);
});

test('pruning keeps active ids and expires stale ones', () => {
  const store = createTrackStore();
  recordSample(store, 'alive', 0, 0, 0);
  recordSample(store, 'gone', 0, 0, 0);
  pruneStore(store, new Set(['alive']), 1000, 500);
  assert.ok(store.entries.alive, 'active track is kept during the grace period');
  pruneStore(store, new Set(['alive']), 1000, 5000);
  assert.equal(store.entries.gone, undefined, 'stale track is dropped');
  assert.ok(store.entries.alive);
});

test('history is bounded', () => {
  const store = createTrackStore();
  for (let i = 0; i < 200; i += 1) recordSample(store, 'a', i * 50, i, 0);
  assert.ok(store.entries.a.length <= 20);
});

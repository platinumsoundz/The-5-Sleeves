// Remote entities are broadcast at 20 Hz. Rendering them at the exact snapshot
// position makes them visibly hop, so we keep a short history and render a
// little in the past, blending between the two surrounding samples.
export const INTERPOLATION_DELAY = 100;
export const EXTRAPOLATION_LIMIT = 0.12;

const HISTORY = 20;
const SAME_POSITION_EPSILON = 0.01;

export function createTrackStore() {
  return { entries: Object.create(null) };
}

export function recordSample(store, id, time, x, y) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return;
  let track = store.entries[id];
  if (!track) track = store.entries[id] = [];
  const last = track[track.length - 1];
  if (last && Math.abs(last.x - x) < SAME_POSITION_EPSILON && Math.abs(last.y - y) < SAME_POSITION_EPSILON) {
    // Standing still: refresh the timestamp so extrapolation never drifts away.
    last.t = time;
    return;
  }
  track.push({ t: time, x, y });
  while (track.length > HISTORY) track.shift();
}

function velocityBetween(a, b) {
  const span = Math.max(1, b.t - a.t);
  return { vx: (b.x - a.x) / span * 1000, vy: (b.y - a.y) / span * 1000 };
}

// Returns the interpolated position (and measured speed) for `id` at `renderTime`.
export function sampleTrack(store, id, renderTime) {
  const track = store.entries[id];
  if (!track || track.length === 0) return null;
  if (track.length === 1) return { x: track[0].x, y: track[0].y, vx: 0, vy: 0 };

  const first = track[0], newest = track[track.length - 1];
  if (renderTime <= first.t) return { x: first.x, y: first.y, vx: 0, vy: 0 };

  if (renderTime >= newest.t) {
    const previous = track[track.length - 2];
    const { vx, vy } = velocityBetween(previous, newest);
    const ahead = Math.min((renderTime - newest.t) / 1000, EXTRAPOLATION_LIMIT);
    return { x: newest.x + vx * ahead, y: newest.y + vy * ahead, vx, vy };
  }

  for (let i = track.length - 1; i > 0; i -= 1) {
    const a = track[i - 1], b = track[i];
    if (renderTime < a.t) continue;
    const span = Math.max(1, b.t - a.t);
    const k = (renderTime - a.t) / span;
    const { vx, vy } = velocityBetween(a, b);
    return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, vx, vy };
  }
  return { x: newest.x, y: newest.y, vx: 0, vy: 0 };
}

// Drops tracks for entities that left the world (after a grace period so a
// brief packet gap does not pop them out of existence).
export function pruneStore(store, activeIds, maxAge, now) {
  for (const id of Object.keys(store.entries)) {
    if (activeIds.has(id)) continue;
    const track = store.entries[id];
    const newest = track[track.length - 1];
    if (!newest || now - newest.t > maxAge) delete store.entries[id];
  }
}

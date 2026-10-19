// Spectate + replay (roadmap #14). A rolling per-zone snapshot buffer powers
// both: observers join a zone's live broadcast, and /api/replay/:zoneId serves
// the last minute of action for offline viewing.
// Snapshot cadence is deliberately low (5 Hz) to keep memory small; the
// client interpolates between frames.
const SAMPLE_MS = 200;
const BUFFER_FRAMES = 300; // 300 × 200 ms = 60 s of history

const buffers = {}; // zoneId -> array of frames (oldest first)
const lastSampleAt = {};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function snapshot(zone, now) {
  return {
    at: now,
    players: clone(zone.players),
    ai: clone(zone.ai),
    projectiles: clone(zone.projectiles),
    objectives: clone(zone.objectivesPayload())
  };
}

function record(zone, now) {
  if (!zone.memberCount) return; // nobody to watch, nothing worth keeping
  if (now - (lastSampleAt[zone.id] || 0) < SAMPLE_MS) return;
  lastSampleAt[zone.id] = now;
  const frames = buffers[zone.id] || (buffers[zone.id] = []);
  frames.push(snapshot(zone, now));
  if (frames.length > BUFFER_FRAMES) frames.splice(0, frames.length - BUFFER_FRAMES);
}

module.exports = {
  name: 'spectate-replay',
  summary: 'Live observer mode and a rolling 60 s replay buffer per zone.',
  priority: 70, // last: it only observes the finished simulation step
  setup(ctx) {
    ctx.on('tick', (zone, now) => record(zone, now));

    // GET /api/replay/:zoneId → the rolling buffer as JSON.
    ctx.route('get', '/api/replay/:zoneId', (request, response) => {
      const zone = ctx.zones()[request.params.zoneId];
      if (!zone) { response.status(404).json({ error: 'unknown zone' }); return; }
      response.json({
        zone: { id: zone.id, name: zone.name, book: zone.book, spirit: zone.spirit, tint: zone.tint },
        frames: buffers[zone.id] || []
      });
    });

    // Observers join the zone's live room without a player object. They get
    // every snapshot but cannot move, fight or be hit.
    ctx.registerSocket('spectate:join', (_player, payload, socket) => {
      const zones = ctx.zones();
      const zoneId = typeof payload?.zone === 'string' && zones[payload.zone] ? payload.zone : Object.keys(zones)[0];
      const zone = zones[zoneId];
      socket.join('zone:' + zone.id);
      socket.emit('spectate:accepted', {
        zone: { id: zone.id, name: zone.name, book: zone.book, spirit: zone.spirit, tint: zone.tint },
        frames: buffers[zone.id] || []
      });
    });
  }
};

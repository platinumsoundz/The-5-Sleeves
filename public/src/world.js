// Ambient world content: deterministic ruin props, named landmarks and the
// story terminals the server places (positions mirror server.js). Kept free of
// DOM references so it can be unit tested in Node.

export const WORLD_DEFAULT = Object.freeze({ width: 1000, height: 700 });
export const PERIMETER_MARGIN = 40;

// Named landmarks: purely evocative, plus their names surface when you are near.
export const LANDMARKS = Object.freeze([
  { id: 'landmark-pylon', name: 'The Fallen Pylon', x: 500, y: 118, radius: 96 },
  { id: 'landmark-parapet', name: 'East Parapet', x: 872, y: 118, radius: 84 },
  { id: 'landmark-terminus', name: 'Transit Terminus', x: 124, y: 612, radius: 84 },
  { id: 'landmark-vault', name: 'Sealed Vault', x: 498, y: 640, radius: 74 }
]);

// Zones the prop scatter must not sit on: the Core, the three relays and the
// three archive terminals.
const RESERVED = Object.freeze([
  { x: 500, y: 350, radius: 150 },
  { x: 250, y: 180, radius: 118 },
  { x: 750, y: 180, radius: 118 },
  { x: 500, y: 560, radius: 118 },
  { x: 138, y: 556, radius: 86 },
  { x: 872, y: 132, radius: 86 },
  { x: 486, y: 626, radius: 86 }
]);

const PROP_KINDS = Object.freeze(['pillar', 'wreck', 'crate', 'husk', 'obelisk']);
const PROP_COUNT = 34;

// Small deterministic PRNG so the ruin scatter is identical every session.
function lcg(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function buildProps(world = WORLD_DEFAULT, count = PROP_COUNT) {
  const random = lcg(0x51ee5 + 17);
  const props = [];
  const margin = PERIMETER_MARGIN + 18;
  for (let attempt = 0; attempt < count * 12 && props.length < count; attempt += 1) {
    const x = margin + random() * (world.width - margin * 2);
    const y = margin + random() * (world.height - margin * 2);
    if (RESERVED.some((zone) => Math.hypot(zone.x - x, zone.y - y) < zone.radius)) continue;
    if (props.some((prop) => Math.hypot(prop.x - x, prop.y - y) < 46)) continue;
    props.push({
      id: 'prop-' + props.length,
      kind: PROP_KINDS[Math.floor(random() * PROP_KINDS.length)],
      x: Math.round(x),
      y: Math.round(y),
      scale: Math.round((0.8 + random() * 0.55) * 100) / 100,
      rotation: Math.round(random() * 360),
      variant: Math.floor(random() * 3)
    });
  }
  return props;
}

export const PROPS = Object.freeze(buildProps());

// Culling helper shared by the renderer.
export function propsInView(props, view) {
  if (!view) return props;
  return props.filter((prop) => prop.x > view.left - 40 && prop.x < view.right + 40 && prop.y > view.top - 40 && prop.y < view.bottom + 40);
}

// The nearest terminal the operative can reach, or null.
export function nearestTerminal(terminals, player) {
  if (!player || !Array.isArray(terminals)) return null;
  let best = null, bestDistance = Infinity;
  for (const terminal of terminals) {
    const away = Math.hypot(terminal.x - player.x, terminal.y - player.y);
    if (away > (terminal.radius || 54)) continue;
    if (away < bestDistance) { bestDistance = away; best = terminal; }
  }
  return best;
}

// Landmarks whose name should be shown while the operative stands inside them.
export function landmarkAt(landmarks, player) {
  if (!player) return null;
  return landmarks.find((landmark) => Math.hypot(landmark.x - player.x, landmark.y - player.y) < (landmark.radius || 80)) || null;
}

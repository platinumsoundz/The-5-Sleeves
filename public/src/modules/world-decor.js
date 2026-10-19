// Ambient ruin decoration: draws the deterministic props and the named
// landmark labels from public/src/world.js. Purely visual, zero game logic.
// Priority 20: boots early so the world is dressed before UI modules.
import { LANDMARKS, PROPS, landmarkAt, propsInView } from '../world.js';

const PROP_COLORS = { pillar: '#3a4440', wreck: '#2f3a3d', crate: '#4a4436', husk: '#3d3631', obelisk: '#333b44' };

function drawProp(ctx, prop) {
  ctx.save();
  ctx.translate(prop.x, prop.y);
  ctx.rotate((prop.rotation * Math.PI) / 180);
  ctx.scale(prop.scale, prop.scale);
  ctx.fillStyle = PROP_COLORS[prop.kind] || '#3a4440';
  ctx.strokeStyle = 'rgba(0,0,0,.5)';
  ctx.lineWidth = 1;
  if (prop.kind === 'pillar' || prop.kind === 'obelisk') {
    ctx.fillRect(-6, -16, 12, 32); ctx.strokeRect(-6, -16, 12, 32);
    ctx.fillStyle = 'rgba(255,255,255,.05)'; ctx.fillRect(-6, -16, 3, 32);
  } else if (prop.kind === 'wreck') {
    ctx.beginPath(); ctx.moveTo(-16, 8); ctx.lineTo(-4, -12); ctx.lineTo(14, -4); ctx.lineTo(12, 10); ctx.closePath();
    ctx.fill(); ctx.stroke();
  } else if (prop.kind === 'crate') {
    ctx.fillRect(-10, -10, 20, 20); ctx.strokeRect(-10, -10, 20, 20);
    ctx.beginPath(); ctx.moveTo(-10, -10); ctx.lineTo(10, 10); ctx.moveTo(10, -10); ctx.lineTo(-10, 10); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.ellipse(0, 4, 14, 9, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

export default {
  name: 'world-decor',
  summary: 'Ambient ruin props and named landmark labels.',
  priority: 20,
  setup(ctx) {
    ctx.on('render:world', ({ ctx: draw, state, view }) => {
      for (const prop of propsInView(PROPS, view)) drawProp(draw, prop);
      const landmark = landmarkAt(LANDMARKS, state.localPlayer);
      if (!landmark) return;
      draw.save();
      draw.fillStyle = 'rgba(207,239,255,.85)';
      draw.font = '11px system-ui, sans-serif';
      draw.textAlign = 'center';
      draw.fillText(landmark.name.toUpperCase(), landmark.x, landmark.y - landmark.radius - 6);
      draw.restore();
    });
  }
};

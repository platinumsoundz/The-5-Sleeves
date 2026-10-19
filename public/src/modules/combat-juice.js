// Combat juice (roadmap #11): hit sparks, floating damage numbers and
// afterimages. Purely client-side feedback layered on the server's combat
// events — the server stays authoritative about all damage and kills.
import { addShake } from '../camera.js';

const MAX_PARTICLES = 120; // hard caps so a long fight cannot leak memory
const MAX_FLOATERS = 24;
const MAX_GHOSTS = 8;
const GHOST_INTERVAL = 55; // ms between afterimage samples
const SPARK_COUNT = 7;

export default {
  name: 'combat-juice',
  summary: 'Hit sparks, floating damage numbers, afterimages.',
  priority: 60,
  setup(ctx) {
    const particles = [];
    const floaters = [];
    const ghosts = [];
    let lastGhostAt = 0;

    function burst(x, y, color, count = SPARK_COUNT) {
      for (let i = 0; i < count && particles.length < MAX_PARTICLES; i += 1) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 60 + Math.random() * 120;
        particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, color, born: performance.now(), life: 380 });
      }
    }

    ctx.on('net:hit', (hit) => {
      burst(hit.x, hit.y, hit.blocked ? '#9fd7ff' : '#ffd9a0');
      if (floaters.length < MAX_FLOATERS && hit.amount > 0) {
        floaters.push({ x: hit.x, y: hit.y - 14, text: String(Math.round(hit.amount)), color: hit.blocked ? '#9fd7ff' : '#ffe9a0', born: performance.now(), life: 850 });
      }
      // Shake scales with proximity so distant fights stay readable.
      const me = ctx.state.localPlayer;
      if (!me) return;
      const away = Math.hypot(hit.x - me.x, hit.y - me.y);
      if (away < 420) addShake(ctx.state.camera, Math.min(6, (1 - away / 420) * 6));
    });

    ctx.on('net:down', (down) => {
      burst(down.x, down.y, '#ff6b7a', 16);
      if (floaters.length < MAX_FLOATERS) {
        floaters.push({ x: down.x, y: down.y - 18, text: (down.name || 'OPERATIVE') + ' DOWN', color: '#ff8b9b', born: performance.now(), life: 1200 });
      }
    });

    ctx.on('frame', ({ state, time, dt }) => {
      // Advance sparks; fade + drift the damage numbers upward.
      for (let i = particles.length - 1; i >= 0; i -= 1) {
        const p = particles[i];
        if (time - p.born > p.life) { particles.splice(i, 1); continue; }
        p.x += p.vx * dt; p.y += p.vy * dt;
      }
      for (let i = floaters.length - 1; i >= 0; i -= 1) {
        if (time - floaters[i].born > floaters[i].life) floaters.splice(i, 1);
      }
      // Sample the local operative for afterimages while moving.
      const me = state.localPlayer;
      if (me && me.hp > 0 && (me.vx || me.vy) && time - lastGhostAt > GHOST_INTERVAL) {
        lastGhostAt = time;
        ghosts.unshift({ x: me.x, y: me.y, color: me.color || '#00ffff', born: time });
        if (ghosts.length > MAX_GHOSTS) ghosts.pop();
      }
    });

    ctx.on('render:fx', ({ ctx: draw, time }) => {
      // Afterimages: fading circles behind the operative's current position.
      for (const ghost of ghosts) {
        const age = (time - ghost.born) / 700;
        if (age >= 1) continue;
        draw.save();
        draw.globalAlpha = (1 - age) * 0.35;
        draw.fillStyle = ghost.color;
        draw.beginPath(); draw.arc(ghost.x, ghost.y - 12, 10 * (1 - age * 0.4), 0, Math.PI * 2); draw.fill();
        draw.restore();
      }
      // Hit sparks.
      for (const p of particles) {
        const fade = 1 - (time - p.born) / p.life;
        draw.save();
        draw.globalAlpha = Math.max(0, fade);
        draw.fillStyle = p.color;
        draw.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
        draw.restore();
      }
      // Floating damage numbers.
      for (const f of floaters) {
        const age = (time - f.born) / f.life;
        draw.save();
        draw.globalAlpha = Math.max(0, 1 - age);
        draw.fillStyle = f.color;
        draw.font = '700 13px system-ui, sans-serif';
        draw.textAlign = 'center';
        draw.fillText(f.text, f.x, f.y - age * 26);
        draw.restore();
      }
    });
  }
};

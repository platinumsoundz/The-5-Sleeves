// Physical hub NPCs and the interaction prompt. The safe bubble and tower
// beacons are drawn by the renderer; this module owns the vendor/gate bodies
// and the readable "F · ..." prompt so they stay plug-and-play.
import { HUB_NPCS } from '../config.js';

const PROMPT_CSS = 'left:50%;bottom:150px;transform:translateX(-50%);background:rgba(9,16,20,.9);border:1px solid rgba(255,224,150,.6);border-radius:8px;padding:7px 14px;color:#ffe9b0;font:700 12px system-ui,sans-serif;letter-spacing:.08em;pointer-events:none;display:none;';

function drawNpc(draw, npc, time) {
  const pulse = 0.5 + 0.5 * Math.sin(time * 0.004 + npc.x);
  draw.save();
  draw.translate(npc.x, npc.y);
  if (npc.kind === 'portal') {
    const radius = 24 + pulse * 4;
    const glow = draw.createRadialGradient(0, 0, 3, 0, 0, radius * 1.7);
    glow.addColorStop(0, npc.color + 'aa');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    draw.fillStyle = glow;
    draw.beginPath(); draw.arc(0, 0, radius * 1.7, 0, Math.PI * 2); draw.fill();
    draw.strokeStyle = npc.color; draw.lineWidth = 2;
    draw.setLineDash([5, 6]); draw.lineDashOffset = -time * 0.02;
    draw.beginPath(); draw.arc(0, 0, radius, 0, Math.PI * 2); draw.stroke();
    draw.setLineDash([]);
    draw.fillStyle = 'rgba(8,20,26,.85)';
    draw.beginPath(); draw.arc(0, 0, radius - 5, 0, Math.PI * 2); draw.fill();
    draw.fillStyle = npc.color; draw.font = 'bold 14px system-ui'; draw.textAlign = 'center';
    draw.fillText(npc.kind === 'portal' && npc.targetZone === 'arena-pve' ? '✚' : '⚔', 0, 5);
  } else {
    draw.fillStyle = 'rgba(9,18,24,.9)';
    draw.fillRect(-11, -16, 22, 30);
    draw.strokeStyle = npc.color; draw.lineWidth = 2;
    draw.strokeRect(-11, -16, 22, 30);
    draw.fillStyle = npc.color;
    draw.beginPath(); draw.arc(0, -21, 7, 0, Math.PI * 2); draw.fill();
    draw.fillStyle = '#1a1308'; draw.font = 'bold 11px system-ui'; draw.textAlign = 'center';
    draw.fillText('$', 0, 5);
  }
  draw.fillStyle = npc.color; draw.font = 'bold 9px system-ui'; draw.textAlign = 'center';
  draw.fillText(String(npc.role || npc.name).toUpperCase(), 0, 34);
  draw.fillStyle = 'rgba(220,245,240,.85)'; draw.font = '10px system-ui';
  draw.fillText(npc.name, 0, 46);
  draw.restore();
}

export default {
  name: 'hub-world',
  summary: 'Physical hub NPCs, portals and interaction prompts.',
  priority: 25,
  setup(ctx) {
    const prompt = ctx.dom(PROMPT_CSS);

    ctx.on('render:world', ({ ctx: draw, state, time }) => {
      if (state.zone?.arena) return;
      for (const npc of state.npcs || HUB_NPCS) drawNpc(draw, npc, time);
    });

    ctx.on('frame', ({ state }) => {
      const me = state.localPlayer;
      if (!me || state.zone?.arena) { prompt.style.display = 'none'; return; }
      let near = null, best = Infinity;
      for (const npc of state.npcs || HUB_NPCS) {
        const away = Math.hypot(npc.x - me.x, npc.y - me.y);
        if (away <= 78 && away < best) { best = away; near = npc; }
      }
      if (!near) { prompt.style.display = 'none'; return; }
      prompt.textContent = 'F · ' + (near.kind === 'shop' ? 'BROWSE SHOP' : 'ENTER ' + String(near.name).toUpperCase());
      prompt.style.borderColor = near.color || 'rgba(255,224,150,.6)';
      prompt.style.display = 'block';
    });
  }
};

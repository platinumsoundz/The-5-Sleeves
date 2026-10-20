// Physical world landmarks: city NPCs, road gates, tower silhouettes and the
// interaction prompt. Pure client module so new landmark types stay plug-and-play.
const PROMPT_CSS = 'left:50%;bottom:150px;transform:translateX(-50%);background:rgba(9,16,20,.9);border:1px solid rgba(255,224,150,.6);border-radius:8px;padding:7px 14px;color:#ffe9b0;font:700 12px system-ui,sans-serif;letter-spacing:.08em;pointer-events:none;display:none;';

function drawNpc(draw, npc, time) {
  const pulse = 0.5 + 0.5 * Math.sin(time * 0.004 + npc.x);
  draw.save();
  draw.translate(npc.x, npc.y);
  const arena = npc.kind === 'arena';
  const glow = draw.createRadialGradient(0, 0, 3, 0, 0, (arena ? 34 : 28) * (1 + pulse * 0.12));
  glow.addColorStop(0, (npc.color || '#ffd479') + 'aa');
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  draw.fillStyle = glow;
  draw.beginPath(); draw.arc(0, 0, (arena ? 34 : 28) * (1 + pulse * 0.12), 0, Math.PI * 2); draw.fill();
  draw.fillStyle = 'rgba(9,18,24,.92)';
  draw.fillRect(-11, -16, 22, 30);
  draw.strokeStyle = npc.color || '#ffd479'; draw.lineWidth = 2;
  draw.strokeRect(-11, -16, 22, 30);
  draw.fillStyle = npc.color || '#ffd479';
  draw.beginPath(); draw.arc(0, -21, 7, 0, Math.PI * 2); draw.fill();
  draw.fillStyle = '#1a1308'; draw.font = 'bold 12px system-ui'; draw.textAlign = 'center';
  draw.fillText(arena ? '⚔' : '¤', 0, 5);
  draw.fillStyle = npc.color; draw.font = 'bold 9px system-ui'; draw.textAlign = 'center';
  draw.fillText(String(npc.role || npc.name).toUpperCase(), 0, 34);
  draw.fillStyle = 'rgba(220,245,240,.85)'; draw.font = '10px system-ui';
  draw.fillText(npc.name, 0, 46);
  draw.restore();
}

function drawGate(draw, state, time, label, x, y, angle) {
  const pulse = 0.55 + 0.45 * Math.sin(time * 0.003);
  draw.save();
  draw.translate(x, y); draw.rotate(angle);
  draw.globalAlpha = 0.25 + pulse * 0.2;
  draw.fillStyle = '#7dffd8';
  draw.beginPath(); draw.moveTo(0, -26); draw.lineTo(22, 0); draw.lineTo(0, 26); draw.closePath(); draw.fill();
  draw.globalAlpha = 0.95; draw.strokeStyle = '#baffee'; draw.lineWidth = 2;
  draw.beginPath(); draw.moveTo(0, -26); draw.lineTo(22, 0); draw.lineTo(0, 26); draw.stroke();
  draw.restore();
  draw.save();
  draw.fillStyle = 'rgba(186,255,238,.9)'; draw.font = 'bold 10px system-ui'; draw.textAlign = 'center';
  draw.fillText(label, x, y + (y < 100 ? 34 : -18));
  draw.restore();
}

function drawTower(draw, tower, time, run, biome) {
  const colors = { water: '#58c8ff', earth: '#d28b4d', fire: '#d7edff', cipher: '#bb8cff' };
  const accent = colors[biome] || '#7dffd8';
  const pulse = 0.6 + Math.sin(time * 0.0025) * 0.3;
  draw.save();
  draw.translate(tower.x, tower.y);
  const glow = draw.createRadialGradient(0, 0, 8, 0, 0, 170);
  glow.addColorStop(0, accent + '29');
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  draw.fillStyle = glow; draw.beginPath(); draw.arc(0, 0, 170, 0, Math.PI * 2); draw.fill();
  draw.fillStyle = '#1b2b31'; draw.fillRect(-26, -46, 52, 116);
  draw.strokeStyle = accent; draw.lineWidth = 2; draw.strokeRect(-26, -46, 52, 116);
  draw.fillStyle = accent; draw.fillRect(-34, -58, 68, 12);
  draw.globalAlpha = 0.4 + pulse * 0.4;
  draw.beginPath(); draw.arc(0, -72, 8 + pulse * 3, 0, Math.PI * 2); draw.fill();
  draw.globalAlpha = 1;
  draw.fillStyle = accent; draw.font = 'bold 11px system-ui'; draw.textAlign = 'center';
  draw.fillText(String(tower.name || 'TOWER').toUpperCase(), 0, -88);
  if (run && run.state !== 'idle') {
    draw.fillStyle = '#ffe9a0'; draw.font = 'bold 10px system-ui';
    draw.fillText(run.state === 'cleared' ? 'TOWER CLEARED' : 'WAVE ' + Math.max(1, run.wave) + '/' + (run.waves || 3) + ' · ' + (run.enemies || 0) + ' LEFT', 0, 82);
  }
  draw.restore();
}

export default {
  name: 'hub-world',
  summary: 'City NPCs, road gates, tower landmarks and interaction prompts.',
  priority: 25,
  setup(ctx) {
    const prompt = ctx.dom(PROMPT_CSS);

    ctx.on('render:world', ({ ctx: draw, state, time }) => {
      const zone = state.zone || {};
      const exits = zone.exits || {};
      if (exits.east) drawGate(draw, state, time, 'EAST ROAD', 966, 350, 0);
      if (exits.west) drawGate(draw, state, time, 'WEST', 34, 350, Math.PI);
      if (exits.north) drawGate(draw, state, time, zone.kind === 'haven' ? 'TOWER GATE' : 'NORTH', 500, 34, -Math.PI / 2);
      if (exits.south) drawGate(draw, state, time, 'CITY', 500, 666, Math.PI / 2);
      if (zone.kind === 'tower' && zone.tower) drawTower(draw, zone.tower, time, state.towerRun, zone.biome);
      for (const npc of state.npcs || []) drawNpc(draw, npc, time);
    });

    ctx.on('frame', ({ state }) => {
      const me = state.localPlayer;
      const zone = state.zone || {};
      if (!me || zone.kind === 'arena') { prompt.style.display = 'none'; return; }
      let near = null, best = Infinity;
      for (const npc of state.npcs || []) {
        const away = Math.hypot(npc.x - me.x, npc.y - me.y);
        if (away <= 78 && away < best) { best = away; near = npc; }
      }
      if (!near) {
        if (zone.kind === 'tower' && state.towerRun && state.towerRun.state !== 'cleared') {
          prompt.textContent = 'SURVIVE ' + (state.towerRun.waves || 3) + ' WAVES';
          prompt.style.display = 'block';
          return;
        }
        prompt.style.display = 'none'; return;
      }
      prompt.textContent = 'F · ' + (near.kind === 'shop' ? 'TRADE' : near.kind === 'arena' ? 'CHOOSE ARENA' : String(near.name).toUpperCase());
      prompt.style.borderColor = near.color || 'rgba(255,224,150,.6)';
      prompt.style.display = 'block';
    });
  }
};

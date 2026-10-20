// Draw server-timed hazard fields so players can see warning and danger areas.
export default {
  name: 'zone-hazards',
  summary: 'World-space warning rings for periodic wilderness hazards.',
  priority: 35,
  setup(ctx) {
    const socket = ctx.state.socket;
    if (socket) socket.on('environment:hazards', (hazards) => {
      ctx.state.environmentHazards = Array.isArray(hazards) ? hazards : [];
    });

    ctx.on('render:world', ({ ctx: draw, state, time }) => {
      const hazards = state.environmentHazards || [];
      for (const hazard of hazards) {
        const remaining = hazard.endsAt - Date.now();
        if (remaining <= 0 && hazard.phase !== 'active') continue;
        const active = hazard.phase === 'active' && remaining > 0;
        const pulse = 0.5 + Math.sin(time * (active ? 0.018 : 0.008)) * 0.18;
        draw.save();
        draw.globalAlpha = active ? 0.62 : hazard.phase === 'warning' ? 0.38 + pulse * 0.3 : 0.18;
        draw.fillStyle = active ? '#ff5148' : hazard.phase === 'warning' ? '#ffd166' : '#85d8d0';
        draw.strokeStyle = draw.fillStyle;
        draw.lineWidth = active ? 4 : 2;
        draw.beginPath(); draw.arc(hazard.x, hazard.y, hazard.radius, 0, Math.PI * 2); draw.fill(); draw.stroke();
        draw.globalAlpha = 0.95;
        draw.textAlign = 'center'; draw.font = 'bold 11px system-ui';
        draw.fillText(active ? hazard.label : hazard.phase === 'warning' ? 'INCOMING · ' + hazard.label : hazard.label, hazard.x, hazard.y - hazard.radius - 10);
        draw.restore();
      }
    });
  }
};

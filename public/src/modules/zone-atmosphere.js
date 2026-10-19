// Zone atmosphere (roadmap #9): tints the screen with the current canon
// zone's colour and announces the zone name for a few seconds after arrival.
// Purely cosmetic — the server decides which zone the operative is in.
// Priority 30: after world dressing, before gameplay UI.
export default {
  name: 'zone-atmosphere',
  summary: 'Per-zone colour tint and arrival banner.',
  priority: 30,
  setup(ctx) {
    let announcedFor = null;
    let announcedAt = 0;

    ctx.on('frame', ({ state, time }) => {
      const zone = state.zone;
      if (!zone) return;
      if (zone.id !== announcedFor) { announcedFor = zone.id; announcedAt = time; }
    });

    ctx.on('render:overlay', ({ ctx: draw, state, time, width, height }) => {
      const zone = state.zone;
      if (!zone) return;
      // Colour wash: very low alpha so gameplay stays readable.
      if (zone.tint) {
        draw.save();
        draw.fillStyle = zone.tint;
        draw.fillRect(0, 0, width, height);
        draw.restore();
      }
      // Arrival banner: fades out over four seconds.
      const age = time - announcedAt;
      if (!announcedFor || age > 4000) return;
      const fade = age < 600 ? age / 600 : Math.max(0, 1 - (age - 600) / 3400);
      draw.save();
      draw.globalAlpha = fade * 0.9;
      draw.textAlign = 'center';
      draw.fillStyle = '#d9fff5';
      draw.font = '700 20px system-ui, sans-serif';
      draw.fillText(zone.name.toUpperCase(), width / 2, height * 0.2);
      draw.fillStyle = '#7fb8ac';
      draw.font = '11px system-ui, sans-serif';
      draw.fillText((zone.book || zone.spirit || '').toUpperCase(), width / 2, height * 0.2 + 20);
      draw.restore();
    });
  }
};

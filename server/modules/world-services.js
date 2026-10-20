// Fast travel between unlocked city spawn points. Cities unlock when reached
// on foot; the map UI can then return to any of them.
module.exports = {
  name: 'world-services',
  summary: 'Unlocked-city fast travel and world map broadcast.',
  priority: 25,
  setup(ctx) {
    ctx.on('joined', (_player, socket) => socket.emit('world:map', ctx.worldMap()));
    ctx.on('zoneChanged', (_player, socket) => socket.emit('world:map', ctx.worldMap()));

    ctx.registerSocket('world:map:request', (player, _payload, socket) => {
      if (player) socket.emit('world:map', ctx.worldMap());
    });

    ctx.registerSocket('city:travel', (player, payload, socket) => {
      if (!player || player.hp <= 0) return;
      const zoneId = typeof payload === 'string' ? payload : payload?.zoneId;
      const zone = ctx.zones()[zoneId];
      if (!zone || zone.kind !== 'haven') {
        socket.emit('travel:error', 'That city is not on the map.');
        return;
      }
      if (!(player.unlockedCities || []).includes(zoneId)) {
        socket.emit('travel:error', 'Reach ' + zone.name + ' on foot before fast travelling there.');
        return;
      }
      if (player.zoneId === zoneId) return;
      ctx.travel(player, zoneId, 'center');
      socket.emit('hub:notice', 'Fast travel: ' + zone.name + '.');
    });
  }
};

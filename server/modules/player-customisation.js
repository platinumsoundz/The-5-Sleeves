// Player self-expression: suit palette plus one of five playable sleeve
// factions. Cipher is a non-playable AI ally; validation stays server-side.
const { ACTIVE_DOMAINS, SLEEVE_COLORS, SLEEVE_ACCENTS } = require('../sim/spec.js');
const { DEFAULT_PALETTE, findPalette } = require('../player-palettes.js');

module.exports = {
  name: 'player-customisation',
  summary: 'Suit-colour palette and title-screen sleeve faction choice.',
  priority: 25,
  setup(ctx) {
    ctx.on('joining', (player, profile) => {
      // server.js stamps the requested faction from the join payload.
      const requested = player.requestedFaction;
      if (ACTIVE_DOMAINS.has(requested)) {
        player.energyColor = requested;
        player.color = SLEEVE_COLORS[requested];
        player.accentColor = SLEEVE_ACCENTS[requested];
      }
      delete player.requestedFaction;
      const saved = findPalette(profile.palette);
      player.palette = saved ? saved.hex : (findPalette(DEFAULT_PALETTE)?.hex || '#7fe8ff');
    });

    ctx.on('persist', (player, record) => { record.palette = player.palette; });

    ctx.registerSocket('player:palette', (player, payload, socket) => {
      const choice = findPalette(payload?.palette);
      if (!player || !choice) return;
      player.palette = choice.hex;
      ctx.persistPlayer(player);
      socket.emit('palette:update', { palette: choice.hex, name: choice.name });
      ctx.playerZone(player.id)?.broadcast();
    });
  }
};

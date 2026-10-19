// Archive story terminals — readable lore stations that pay an XP + core
// bounty once per operative (re-reads still show the log, but pay nothing).
// Terminal definitions live in server/zones-catalog.js so every canon zone
// ships its own set; this module only handles reading and rewards.
// Canon rules for the lore text: memory/02-universe-canon.md.
const RADIUS = 54; // how close an operative must stand to read
const XP = 40; // first-read XP bounty
const CHARGE = 12; // first-read core charge
const RE_READ_COOLDOWN = 600; // ms between interact presses

function payloadFor(zone) {
  return (zone?.terminals || []).map((terminal) => ({ id: terminal.id, name: terminal.name, x: terminal.x, y: terminal.y, radius: RADIUS }));
}

module.exports = {
  name: 'archive-terminals',
  summary: 'Readable lore terminals; XP + core bounty once per operative.',
  setup(ctx) {
    function nearest(player, zone) {
      let best = null, bestDistance = RADIUS;
      for (const terminal of zone?.terminals || []) {
        const away = ctx.distance(player, terminal);
        if (away <= bestDistance) { bestDistance = away; best = terminal; }
      }
      return best;
    }

    // Profiles remember which terminals an operative already claimed.
    ctx.on('joining', (player, profile) => {
      player.terminalsRead = Array.isArray(profile.terminalsRead) ? profile.terminalsRead.slice() : [];
    });

    // Ride along with the profile save so progress survives restarts.
    ctx.on('persist', (player, record) => { record.terminalsRead = player.terminalsRead || []; });

    // Tell each operative where their zone's terminals are.
    function announce(player, socket) {
      const zone = ctx.playerZone(player.id);
      socket.emit('archive:terminals', { terminals: payloadFor(zone), read: player.terminalsRead || [], zoneId: zone?.id });
    }
    ctx.on('joined', announce);
    // Travelling to another zone swaps in that zone's terminal set.
    ctx.on('zoneChanged', announce);

    // Terminals are re-readable; the bounty only pays the first time.
    ctx.registerSocket('player:interact', (player, _payload, socket) => {
      const now = Date.now();
      if (!player || player.hp <= 0 || now - (player.lastInteractAt || 0) < RE_READ_COOLDOWN) return;
      const zone = ctx.playerZone(player.id);
      const terminal = nearest(player, zone);
      if (!terminal) { socket.emit('archive:terminal', { found: false }); return; }
      player.lastInteractAt = now;
      const firstRead = !(player.terminalsRead || []).includes(terminal.id);
      if (firstRead) {
        player.terminalsRead.push(terminal.id);
        player.coreCharge = Math.min(99.99, player.coreCharge + CHARGE);
        ctx.applyXp(player, XP);
      }
      socket.emit('archive:terminal', {
        found: true,
        id: terminal.id,
        name: terminal.name,
        log: terminal.log,
        firstRead,
        xp: firstRead ? Math.round(XP * ctx.xpScale()) : 0,
        read: player.terminalsRead.length,
        total: (zone?.terminals || []).length
      });
    });
  }
};

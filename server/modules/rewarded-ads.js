// Opt-in rewarded adverts (AdSense H5 "reward" breaks). Rewards are
// money-adjacent, so the browser is never trusted: it asks for a single-use
// token in a valid context, watches the ad, then claims the token. Context,
// cooldowns and daily caps are re-checked on claim. Economy values live in
// server/ads-catalog.js.
const crypto = require('crypto');
const {
  OFFERS, MIN_WATCH_MS, TOKEN_TTL_MS, RALLY_WINDOW_MS,
  rollDay, cooldownLeft, contextOk, offerPayload, offerSignature
} = require('../ads-catalog.js');

module.exports = {
  name: 'rewarded-ads',
  summary: 'Opt-in AdSense supply transmissions: credits, shield overcharge, tower revives.',
  priority: 45,
  setup(ctx) {
    const tokens = new Map();
    const published = new Map();

    function publish(player, socket) {
      const zone = ctx.playerZone(player.id);
      if (!zone) return;
      published.set(player.id, offerSignature(player, zone, Date.now()));
      socket.emit('ad:offers', offerPayload(player, zone));
    }

    const deny = (socket, offerId, reason) => socket.emit('ad:denied', { offerId, reason });

    ctx.on('joining', (player, profile) => {
      // Restore saved counters before rollDay, or relogging would reset caps.
      player.adDay = profile.adDay;
      player.adCounts = profile.adCounts && typeof profile.adCounts === 'object' ? { ...profile.adCounts } : {};
      player.adLastAt = profile.adLastAt && typeof profile.adLastAt === 'object' ? { ...profile.adLastAt } : {};
      rollDay(player);
    });

    ctx.on('joined', (player, socket) => { rollDay(player); publish(player, socket); });
    ctx.on('zoneChanged', (player, socket) => publish(player, socket));

    ctx.on('persist', (player, record) => {
      record.adDay = player.adDay || new Date().toISOString().slice(0, 10);
      record.adCounts = player.adCounts || {};
      record.adLastAt = player.adLastAt || {};
    });

    ctx.on('left', (player) => {
      published.delete(player.id);
      for (const [key, token] of tokens) if (token.playerId === player.id) tokens.delete(key);
    });

    ctx.on('tick', (zone, now) => {
      for (const player of Object.values(zone.players)) {
        if (player.hp > 0) player.rallyArmed = false;
        else if (!player.rallyArmed) {
          player.rallyArmed = true;
          player.rallyWindowUntil = 0;
          // Hold the return trip briefly so the death panel can offer a revive.
          if (zone.kind === 'tower' && zone.towerRun?.state === 'active') {
            player.rallyWindowUntil = now + RALLY_WINDOW_MS;
            player.respawnAt = Math.max(player.respawnAt || 0, now + RALLY_WINDOW_MS);
          }
        }
        const socket = ctx.playerSockets()[player.id];
        if (!socket) continue;
        rollDay(player);
        const next = offerSignature(player, zone, now);
        if (published.get(player.id) === next) continue;
        published.set(player.id, next);
        socket.emit('ad:offers', offerPayload(player, zone));
      }
    });

    // The operative tapped a reward button. Issue one short-lived token.
    ctx.registerSocket('ad:request', (player, payload, socket) => {
      if (!player) return;
      const now = Date.now();
      const offerId = String(payload?.offerId || '');
      if (!OFFERS[offerId]) return;
      rollDay(player);
      const zone = ctx.playerZone(player.id);
      if (!contextOk(player, zone, offerId, now)) return deny(socket, offerId, 'That transmission is not available here.');
      if (cooldownLeft(player, offerId, now) > 0) return deny(socket, offerId, 'Supply channel recharging.');
      if ((player.adCounts[offerId] || 0) >= OFFERS[offerId].dailyCap) return deny(socket, offerId, 'Daily transmission limit reached.');

      // One outstanding token per operative keeps the map small.
      for (const [key, token] of tokens) if (token.playerId === player.id) tokens.delete(key);
      const token = crypto.randomBytes(12).toString('hex');
      tokens.set(token, { playerId: player.id, offerId, zoneId: zone.id, issuedAt: now });
      // Keep the body in the tower while the transmission plays.
      if (offerId === 'rally') player.respawnAt = now + TOKEN_TTL_MS;
      socket.emit('ad:grant', { token, offerId, minWatchMs: MIN_WATCH_MS, expiresAt: now + TOKEN_TTL_MS });
    });

    // The ad reported "viewed". Pay only if the token and context still hold.
    ctx.registerSocket('ad:claim', (player, payload, socket) => {
      const now = Date.now();
      const key = String(payload?.token || '');
      const token = tokens.get(key);
      if (!player || !token || token.playerId !== player.id) return;
      const refuse = (reason) => { tokens.delete(key); deny(socket, token.offerId, reason); };
      if (now - token.issuedAt < MIN_WATCH_MS) return refuse('Transmission too short to count.');
      if (now - token.issuedAt > TOKEN_TTL_MS) return refuse('Transmission expired.');
      const zone = ctx.playerZone(player.id);
      if (!zone || zone.id !== token.zoneId) return refuse('You left the supply channel.');
      if (token.offerId === 'rally' ? player.hp > 0 : (player.hp <= 0 || zone.kind !== 'haven')) {
        return refuse('Supply channel closed.');
      }

      tokens.delete(key);
      const offer = OFFERS[token.offerId];
      player.adCounts[token.offerId] = (player.adCounts[token.offerId] || 0) + 1;
      player.adLastAt[token.offerId] = now;
      const reward = { offerId: token.offerId, credits: 0 };
      if (token.offerId === 'supply') {
        player.credits = (player.credits || 0) + offer.credits;
        reward.credits = offer.credits;
      } else if (token.offerId === 'overcharge') {
        player.shieldUntil = Math.max(player.shieldUntil || 0, now + offer.shieldMs);
        reward.shieldMs = offer.shieldMs;
      } else {
        player.hp = Math.max(1, Math.round(player.maxHp * offer.reviveRatio));
        player.respawnAt = 0;
        player.rallyArmed = false;
        player.rallyWindowUntil = 0;
        reward.revived = true;
      }
      ctx.persistPlayer(player);
      zone.broadcast();
      socket.emit('ad:reward', reward);
      publish(player, socket);
    });

    // Dismissed, blocked or failed: release the revive hold immediately.
    ctx.registerSocket('ad:abandon', (player, payload) => {
      const key = String(payload?.token || '');
      const token = tokens.get(key);
      if (!player || !token || token.playerId !== player.id) return;
      tokens.delete(key);
      if (token.offerId === 'rally' && player.hp <= 0) player.respawnAt = Date.now() + 400;
    });

    // "Return to city" on the death panel: skip the rest of the offer window.
    ctx.registerSocket('ad:skip', (player) => {
      if (!player || player.hp > 0) return;
      if ((player.rallyWindowUntil || 0) > Date.now()) {
        player.rallyWindowUntil = 0;
        player.respawnAt = Date.now() + 300;
      }
    });
  },
  // Extra exports let the regression tests pin the safety numbers.
  OFFERS, MIN_WATCH_MS, TOKEN_TTL_MS, RALLY_WINDOW_MS
};

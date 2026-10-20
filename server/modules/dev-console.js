'use strict';

const crypto = require('crypto');
const { SHOP_ITEMS } = require('../shop-catalog.js');
const { SKILL_TREE } = require('../skill-tree.js');

const MAX_CREDITS = 999999;
const MAX_SKILL_POINTS = 9999;
const MAX_CORE_POINTS = 9999;
const TOKEN_MIN_LENGTH = 32;

function tokenMatches(candidate, expected) {
  if (typeof candidate !== 'string' || candidate.length > 256) return false;
  const supplied = Buffer.from(candidate);
  const secret = Buffer.from(expected);
  return supplied.length === secret.length && crypto.timingSafeEqual(supplied, secret);
}

module.exports = {
  name: 'dev-console',
  summary: 'Non-production, token-gated test grants for developer accounts.',
  priority: 80,
  setup(ctx) {
    const enabled = process.env.NODE_ENV !== 'production'
      && process.env.DEV_CONSOLE_ENABLED === 'true'
      && (process.env.DEV_CONSOLE_TOKEN || '').length >= TOKEN_MIN_LENGTH;
    const sessions = new Map();

    ctx.route('get', '/api/dev-console/status', (_request, response) => response.json({ enabled }));
    ctx.registerSocket('dev:authorize', (_player, payload, socket) => {
      if (!enabled) { socket.emit('dev:error', 'Developer console is disabled.'); return; }
      const now = Date.now();
      let entry = sessions.get(socket.id);
      if (!entry || now - entry.windowAt > 60000) entry = { windowAt: now, attempts: 0, authorized: false };
      entry.attempts += 1;
      if (entry.attempts > 5) { sessions.set(socket.id, entry); socket.emit('dev:error', 'Too many attempts. Reconnect to try again.'); return; }
      entry.authorized = tokenMatches(payload?.token, process.env.DEV_CONSOLE_TOKEN);
      sessions.set(socket.id, entry);
      socket.emit(entry.authorized ? 'dev:authorized' : 'dev:error', entry.authorized ? 'Developer console unlocked.' : 'Invalid developer token.');
    });

    ctx.registerSocket('dev:grant', (player, payload, socket) => {
      if (!enabled || !player || !sessions.get(socket.id)?.authorized || payload?.grant !== 'all') {
        socket.emit('dev:error', 'Developer authorization required.');
        return;
      }
      player.credits = MAX_CREDITS;
      player.skillPoints = MAX_SKILL_POINTS;
      player.corePoints = MAX_CORE_POINTS;
      player.inventory = Array.from(new Set([...(player.inventory || []), ...SHOP_ITEMS.map((item) => item.id)]));
      player.skills = Object.fromEntries(SKILL_TREE.map((node) => [node.id, true]));
      player.terminalsRead = Array.from(new Set([...(player.terminalsRead || []), ...Object.values(ctx.zones()).flatMap((zone) => (zone.terminals || []).map((item) => item.id))]));
      ctx.persistPlayer(player);
      ctx.playerZone(player.id)?.broadcast();
      socket.emit('dev:granted', { credits: player.credits, skillPoints: player.skillPoints, items: player.inventory.length });
    });

    ctx.on('left', (player) => {
      const socket = ctx.playerSockets()[player.id];
      if (socket) sessions.delete(socket.id);
    });
  }
};

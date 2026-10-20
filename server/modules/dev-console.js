'use strict';

const crypto = require('crypto');
const { ITEM_CATALOG } = require('../shop-catalog.js');
const { SKILL_TREE } = require('../skill-tree.js');

const MAX_CREDITS = 999999;
const MAX_SKILL_POINTS = 9999;
const MAX_CORE_POINTS = 9999;
const ALLOWED_GRANTS = new Set(['credits', 'skills', 'items', 'collectibles', 'all']);

function configuredCodes() {
  try {
    const parsed = JSON.parse(process.env.DEV_CONSOLE_CODES || '{}');
    return Object.entries(parsed).filter(([code, grant]) => code.length >= 8 && ALLOWED_GRANTS.has(grant));
  } catch (_) { return []; }
}
function codeMatches(candidate, expected) {
  if (typeof candidate !== 'string' || candidate.length > 256) return false;
  const supplied = Buffer.from(candidate);
  const secret = Buffer.from(expected);
  return supplied.length === secret.length && crypto.timingSafeEqual(supplied, secret);
}

module.exports = {
  name: 'dev-console',
  summary: 'Non-production, server-configured grant codes for test accounts.',
  priority: 80,
  setup(ctx) {
    const codes = configuredCodes();
    const enabled = process.env.NODE_ENV !== 'production'
      && process.env.DEV_CONSOLE_ENABLED === 'true'
      && codes.length > 0;
    const attempts = new Map();

    ctx.route('get', '/api/dev-console/status', (_request, response) => response.json({ enabled }));
    ctx.registerSocket('dev:redeem', (player, payload, socket) => {
      if (!enabled || !player) { socket.emit('dev:error', 'Developer codes are disabled.'); return; }
      const now = Date.now();
      let entry = attempts.get(socket.id);
      if (!entry || now - entry.windowAt > 60000) entry = { windowAt: now, count: 0 };
      entry.count += 1;
      attempts.set(socket.id, entry);
      if (entry.count > 5) { socket.emit('dev:error', 'Too many code attempts. Reconnect to try again.'); return; }

      let grant = null;
      for (const [code, kind] of codes) if (codeMatches(payload?.code, code)) grant = kind;
      if (!grant) { socket.emit('dev:error', 'That developer code is not valid.'); return; }
      applyGrant(player, grant, ctx);
      ctx.persistPlayer(player);
      ctx.playerZone(player.id)?.broadcast();
      socket.emit('dev:redeemed', { grant, credits: player.credits || 0, skillPoints: player.skillPoints || 0, items: player.inventory?.length || 0 });
    });

    ctx.on('left', (player) => {
      const socket = ctx.playerSockets()[player.id];
      if (socket) attempts.delete(socket.id);
    });
  }
};

function applyGrant(player, grant, ctx) {
  if (grant === 'credits' || grant === 'all') player.credits = MAX_CREDITS;
  if (grant === 'skills' || grant === 'all') {
    player.skillPoints = MAX_SKILL_POINTS;
    player.corePoints = MAX_CORE_POINTS;
    player.skills = Object.fromEntries(SKILL_TREE.map((node) => [node.id, true]));
  }
  if (grant === 'items' || grant === 'all') {
    player.inventory = Array.from(new Set([...(player.inventory || []), ...Object.keys(ITEM_CATALOG)]));
  }
  if (grant === 'collectibles' || grant === 'all') {
    player.terminalsRead = Array.from(new Set([...(player.terminalsRead || []), ...Object.values(ctx.zones()).flatMap((zone) => (zone.terminals || []).map((item) => item.id))]));
  }
}

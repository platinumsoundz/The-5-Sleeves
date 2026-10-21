// Tunable rewarded-ad catalogue plus the pure eligibility rules. Kept apart
// from the socket flow so a novice can change payouts, cooldowns and caps
// without reading the token handshake in server/modules/rewarded-ads.js.

const TOKEN_TTL_MS = 3 * 60 * 1000;   // how long one transmission may take
const MIN_WATCH_MS = 5000;            // floor: an instant claim was not a watch
const RALLY_WINDOW_MS = 12000;        // tower death screen: offer lifetime

// `dailyCap` resets at 00:00 UTC per operative.
const OFFERS = {
  supply: { reward: '+100 CREDITS', credits: 100, cooldownMs: 10 * 60000, dailyCap: 10 },
  overcharge: { reward: '90s SHIELD', shieldMs: 90000, cooldownMs: 20 * 60000, dailyCap: 6 },
  rally: { reward: 'REJOIN THE TOWER', reviveRatio: 0.6, cooldownMs: 0, dailyCap: 8 }
};

function today() { return new Date().toISOString().slice(0, 10); }

function rollDay(player) {
  if (player.adDay !== today()) { player.adDay = today(); player.adCounts = {}; }
  if (!player.adCounts) player.adCounts = {};
  if (!player.adLastAt) player.adLastAt = {};
}

function cooldownLeft(player, id, now) {
  return Math.max(0, (player.adLastAt?.[id] || 0) + OFFERS[id].cooldownMs - now);
}

function contextOk(player, zone, id, now) {
  if (!player || !zone) return false;
  // Reviving is only offered on a real tower death, never in a safe city.
  if (id === 'rally') return zone.kind === 'tower' && player.hp <= 0 && (player.rallyWindowUntil || 0) > now;
  return zone.kind === 'haven' && player.hp > 0;
}

function ready(player, zone, id, now) {
  return contextOk(player, zone, id, now)
    && cooldownLeft(player, id, now) <= 0
    && (player.adCounts?.[id] || 0) < OFFERS[id].dailyCap;
}

// What the client shows: the three offers plus the timing knobs it needs.
function offerPayload(player, zone) {
  const now = Date.now();
  rollDay(player);
  return {
    zoneId: zone.id,
    zoneKind: zone.kind,
    dead: player.hp <= 0,
    rallyWindowMs: RALLY_WINDOW_MS,
    minWatchMs: MIN_WATCH_MS,
    offers: Object.entries(OFFERS).map(([id, offer]) => ({
      id, reward: offer.reward, ready: ready(player, zone, id, now),
      cooldownMs: cooldownLeft(player, id, now),
      used: player.adCounts[id] || 0, cap: offer.dailyCap
    }))
  };
}

// Cheap change detector for the per-tick publish (no object allocation).
function offerSignature(player, zone, now) {
  const flags = Object.keys(OFFERS).map((id) => (ready(player, zone, id, now) ? '1' : '0')).join('');
  return zone.id + ':' + (player.hp > 0 ? '1' : '0') + ':' + flags;
}

module.exports = {
  OFFERS, MIN_WATCH_MS, TOKEN_TTL_MS, RALLY_WINDOW_MS,
  rollDay, cooldownLeft, contextOk, ready, offerPayload, offerSignature
};

// Resting in a safe city's Core gives a small daily credit stipend.
// The inactivity gate keeps walking in circles from being a farming route.
const { CORE } = require('../sim/state.js');
const { distance } = require('../sim/combat.js');

const IDLE_MS = 30000;
const REWARD_INTERVAL_MS = 300000;
const CREDITS_PER_REWARD = 5;
const DAILY_CREDIT_CAP = 20;
const CORE_HEAL_RATE = 0.03;

function activityStamp(player) {
  return [player.lastAttackAt, player.lastDashAt, player.lastShieldAt, player.lastAbilityAt].join(':');
}
function today() { return new Date().toISOString().slice(0, 10); }

module.exports = {
  name: 'core-meditation',
  summary: 'Safe-city Cipher Cores heal operatives and grant capped idle credits.',
  priority: 60,
  setup(ctx) {
    const sessions = new Map();

    ctx.on('joining', (player, profile) => {
      player.meditationDay = profile.meditationDay || today();
      player.meditationCredits = Number.isFinite(profile.meditationCredits) ? profile.meditationCredits : 0;
      if (player.meditationDay !== today()) { player.meditationDay = today(); player.meditationCredits = 0; }
    });
    ctx.on('persist', (player, record) => {
      record.meditationDay = player.meditationDay || today();
      record.meditationCredits = player.meditationCredits || 0;
    });
    ctx.on('left', (player) => sessions.delete(player.id));
    ctx.on('tick', (zone, now, deltaSeconds = 0) => {
      for (const player of Object.values(zone.players)) {
        if (player.meditationDay !== today()) { player.meditationDay = today(); player.meditationCredits = 0; }
        let session = sessions.get(player.id);
        if (!session) {
          session = { x: player.x, y: player.y, activity: activityStamp(player), idleSince: now, nextRewardAt: now + IDLE_MS, inCore: false };
          sessions.set(player.id, session);
        }
        const inside = zone.kind === 'haven' && player.hp > 0 && distance(player, CORE) <= CORE.radius;
        if (inside && player.hp < player.maxHp && deltaSeconds > 0) {
          player.hp = Math.min(player.maxHp, player.hp + player.maxHp * CORE_HEAL_RATE * deltaSeconds);
        }
        const moved = Math.hypot(player.x - session.x, player.y - session.y) > 2;
        const acted = activityStamp(player) !== session.activity;
        session.x = player.x;
        session.y = player.y;
        session.activity = activityStamp(player);

        if (!inside) {
          session.inCore = false;
          session.idleSince = now;
          session.nextRewardAt = now + IDLE_MS;
          continue;
        }
        if (!session.inCore) {
          session.inCore = true;
          session.idleSince = now;
          session.nextRewardAt = now + IDLE_MS;
        }
        if (moved || acted) {
          session.idleSince = now;
          session.nextRewardAt = now + IDLE_MS;
          continue;
        }
        if (now - session.idleSince < IDLE_MS || now < session.nextRewardAt || player.meditationCredits >= DAILY_CREDIT_CAP) continue;

        const reward = Math.min(CREDITS_PER_REWARD, DAILY_CREDIT_CAP - player.meditationCredits);
        player.credits = (player.credits || 0) + reward;
        player.meditationCredits += reward;
        session.nextRewardAt = now + REWARD_INTERVAL_MS;
        ctx.persistPlayer(player);
        ctx.playerSockets()[player.id]?.emit('hub:notice', 'Cipher Core meditation: +' + reward + ' credits.');
        zone.broadcast();
      }
    });
  }
};

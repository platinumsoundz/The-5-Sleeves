// Resting in a safe city's Core gives a small, session-capped credit stipend.
// The inactivity gate keeps walking in circles from being a farming route.
const { CORE } = require('../sim/state.js');
const { distance } = require('../sim/combat.js');

const IDLE_MS = 30000;
const REWARD_INTERVAL_MS = 300000;
const CREDITS_PER_REWARD = 5;
const SESSION_CREDIT_CAP = 20;

function activityStamp(player) {
  return [player.lastAttackAt, player.lastDashAt, player.lastShieldAt, player.lastAbilityAt].join(':');
}

module.exports = {
  name: 'core-meditation',
  summary: 'Capped passive credits for resting at a safe-city Cipher Core.',
  priority: 60,
  setup(ctx) {
    const sessions = new Map();

    ctx.on('left', (player) => sessions.delete(player.id));
    ctx.on('tick', (zone, now) => {
      for (const player of Object.values(zone.players)) {
        let session = sessions.get(player.id);
        if (!session) {
          session = { x: player.x, y: player.y, activity: activityStamp(player), idleSince: now, nextRewardAt: now + REWARD_INTERVAL_MS, earned: 0, inCore: false };
          sessions.set(player.id, session);
        }
        const inside = zone.kind === 'haven' && player.hp > 0 && distance(player, CORE) <= CORE.radius;
        const moved = Math.hypot(player.x - session.x, player.y - session.y) > 2;
        const acted = activityStamp(player) !== session.activity;
        session.x = player.x;
        session.y = player.y;
        session.activity = activityStamp(player);

        if (!inside) {
          session.inCore = false;
          session.idleSince = now;
          session.nextRewardAt = now + REWARD_INTERVAL_MS;
          continue;
        }
        if (!session.inCore) {
          session.inCore = true;
          session.idleSince = now;
          session.nextRewardAt = now + REWARD_INTERVAL_MS;
        }
        if (moved || acted) {
          session.idleSince = now;
          session.nextRewardAt = now + REWARD_INTERVAL_MS;
          continue;
        }
        if (now - session.idleSince < IDLE_MS || now < session.nextRewardAt || session.earned >= SESSION_CREDIT_CAP) continue;

        const reward = Math.min(CREDITS_PER_REWARD, SESSION_CREDIT_CAP - session.earned);
        player.credits = (player.credits || 0) + reward;
        session.earned += reward;
        session.nextRewardAt = now + REWARD_INTERVAL_MS;
        ctx.persistPlayer(player);
        ctx.playerSockets()[player.id]?.emit('hub:notice', 'Cipher Core meditation: +' + reward + ' credits.');
        zone.broadcast();
      }
    });
  }
};

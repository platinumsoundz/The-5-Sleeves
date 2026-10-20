'use strict';

const { damageTarget, distance } = require('../sim/combat.js');

const CYCLE_MS = 10000;
const IDLE_MS = 5000;
const WARNING_MS = 3000;
const DAMAGE = 12;
const HAZARDS = {
  'wild-perimeter': { id: 'fog-pulse', label: 'FOG SURGE', x: 720, y: 210, radius: 72 },
  'wild-coast': { id: 'tide-surge', label: 'TIDELINE SURGE', x: 270, y: 500, radius: 76 },
  'wild-scorched': { id: 'heat-vent', label: 'HEAT VENT', x: 720, y: 210, radius: 70 },
  'wild-frozen': { id: 'frost-break', label: 'ICE SHEAR', x: 270, y: 500, radius: 74 },
  'wild-apex': { id: 'cipher-static', label: 'STATIC FIELD', x: 720, y: 210, radius: 68 }
};

function phaseAt(now) {
  const phase = now % CYCLE_MS;
  if (phase < IDLE_MS) return { phase: 'idle', endsAt: now + IDLE_MS - phase };
  if (phase < IDLE_MS + WARNING_MS) return { phase: 'warning', endsAt: now + IDLE_MS + WARNING_MS - phase };
  return { phase: 'active', endsAt: now + CYCLE_MS - phase };
}

module.exports = {
  name: 'zone-hazards',
  summary: 'Telegraphed, periodic environmental damage in wilderness roads.',
  priority: 55,
  setup(ctx) {
    const lastPhase = new Map();
    const lastHitCycle = new Map();
    function sendCurrent(socket, zone) {
      const hazard = HAZARDS[zone?.id];
      const hazards = hazard && zone.kind === 'wild'
        ? [{ ...hazard, ...phaseAt(Date.now()), damage: DAMAGE }] : [];
      socket?.emit('environment:hazards', hazards);
    }
    ctx.on('joined', (player, socket) => sendCurrent(socket, ctx.playerZone(player.id)));
    ctx.on('zoneChanged', (player, socket) => sendCurrent(socket, ctx.playerZone(player.id)));
    ctx.on('left', (player) => lastHitCycle.delete(player.id));
    ctx.on('tick', (zone, now) => {
      const hazard = HAZARDS[zone.id];
      if (!hazard || zone.kind !== 'wild') return;
      const timing = phaseAt(now);
      if (lastPhase.get(zone.id) !== timing.phase) {
        lastPhase.set(zone.id, timing.phase);
        zone.send('environment:hazards', [{ ...hazard, ...timing, damage: DAMAGE }]);
      }
      if (timing.phase !== 'active') return;
      const cycle = Math.floor(now / CYCLE_MS);
      for (const player of Object.values(zone.players)) {
        const key = player.id + ':' + hazard.id;
        if (player.hp <= 0 || distance(player, hazard) > hazard.radius || lastHitCycle.get(key) === cycle) continue;
        lastHitCycle.set(key, cycle);
        damageTarget(zone, player, DAMAGE, { id: hazard.id, name: hazard.label }, 'environment');
      }
    });
  }
};

module.exports.phaseAt = phaseAt;
module.exports.HAZARDS = HAZARDS;

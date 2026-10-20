// Safe-zone hub services: shop NPC, PvP/PvE portal gates, and regional tower
// unlocks. Physical NPCs live on each canon zone simulation (sim.npcs); this
// module only reacts to interaction, validates purchases and announces state.
const { SHOP_ITEMS, DEFAULT_INVENTORY, DEFAULT_EQUIPPED, itemById } = require('../shop-catalog.js');
const { XP_TOWER } = require('../sim/spec.js');

const INTERACT_RADIUS = 78;
const SHOP_RADIUS = 120;
const TOWER_RADIUS = 72;

function nearestNpc(zone, player) {
  let best = null, bestDistance = Infinity;
  for (const npc of zone?.npcs || []) {
    const away = Math.hypot(npc.x - player.x, npc.y - player.y);
    if (away <= Math.max(INTERACT_RADIUS, npc.radius || 0) && away < bestDistance) {
      best = npc; bestDistance = away;
    }
  }
  return best;
}

function shopPayload(player) {
  return {
    items: SHOP_ITEMS,
    inventory: player.inventory || [],
    equipped: player.equipped || {},
    corePoints: player.corePoints || 0
  };
}

module.exports = {
  name: 'hub-services',
  summary: 'Safe hub, physical NPC shop, PvP/PvE portals and tower unlocks.',
  priority: 20,
  setup(ctx) {
    ctx.on('joining', (player, profile) => {
      const stored = Array.isArray(profile.inventory) ? profile.inventory.filter(itemById) : [];
      player.inventory = stored.length ? stored : DEFAULT_INVENTORY.slice();
      player.equipped = { ...DEFAULT_EQUIPPED, ...(profile.equipped || {}) };
      for (const slot of Object.keys(player.equipped)) {
        if (!itemById(player.equipped[slot])) player.equipped[slot] = DEFAULT_EQUIPPED[slot] || null;
      }
    });

    ctx.on('persist', (player, record) => {
      record.inventory = player.inventory || [];
      record.equipped = player.equipped || {};
    });

    function announce(player, socket) {
      const zone = ctx.playerZone(player.id);
      if (!zone) return;
      socket.emit('hub:state', {
        zoneId: zone.id,
        mode: zone.mode,
        arena: !!zone.arena,
        friendlyFire: zone.friendlyFire !== false,
        safe: zone.safe || null,
        npcs: zone.npcs || [],
        towers: zone.towers || []
      });
    }
    ctx.on('joined', announce);
    ctx.on('zoneChanged', announce);

    // F / Y / READ: talk to a nearby physical NPC.
    ctx.registerSocket('player:interact', (player, _payload, socket) => {
      if (!player || player.hp <= 0) return;
      const zone = ctx.playerZone(player.id);
      const npc = nearestNpc(zone, player);
      if (!npc) return;
      const now = Date.now();
      if (now - (player.lastNpcInteractAt || 0) < 700) return;
      player.lastNpcInteractAt = now;
      if (npc.kind === 'shop') {
        socket.emit('shop:open', shopPayload(player));
        return;
      }
      if (npc.kind === 'portal' && npc.targetZone) {
        socket.emit('hub:notice', 'Entering ' + npc.name + '…');
        ctx.travel(player, npc.targetZone);
      }
    });

    ctx.registerSocket('shop:buy', (player, payload, socket) => {
      if (!player) return;
      const item = itemById(payload?.itemId);
      const zone = ctx.playerZone(player.id);
      if (!item || !zone) return;
      const inHub = zone.safe && Math.hypot(player.x - zone.safe.x, player.y - zone.safe.y) <= zone.safe.radius;
      const shop = nearestNpc(zone, player);
      if (!inHub && (!shop || shop.kind !== 'shop' || Math.hypot(shop.x - player.x, shop.y - player.y) > SHOP_RADIUS)) {
        socket.emit('shop:error', 'Stand at Quartermaster Vale’s stall to trade.');
        return;
      }
      if ((player.inventory || []).includes(item.id)) {
        socket.emit('shop:error', 'That item is already in your inventory.');
        return;
      }
      if ((player.corePoints || 0) < item.price) {
        socket.emit('shop:error', 'Not enough Core Points (' + item.price + ' needed).');
        return;
      }
      player.corePoints -= item.price;
      player.inventory.push(item.id);
      if (item.slot !== 'supply' && player.equipped && !player.equipped[item.slot]) player.equipped[item.slot] = item.id;
      ctx.persistPlayer(player);
      socket.emit('shop:update', shopPayload(player));
      zone.broadcast();
    });

    ctx.registerSocket('player:equip', (player, payload, socket) => {
      const item = itemById(payload?.itemId);
      if (!player || !item || item.slot === 'supply' || !(player.inventory || []).includes(item.id)) return;
      player.equipped = player.equipped || {};
      player.equipped[item.slot] = item.id;
      ctx.persistPlayer(player);
      socket.emit('shop:update', shopPayload(player));
      ctx.playerZone(player.id)?.broadcast();
    });

    // Stand near a dormant tower to unlock it and push the fogline back.
    ctx.on('tick', (zone) => {
      if (!zone.towers?.length) return;
      for (const player of Object.values(zone.players)) {
        if (player.hp <= 0) continue;
        for (const tower of zone.towers) {
          if (tower.unlocked) continue;
          if (Math.hypot(tower.x - player.x, tower.y - player.y) > TOWER_RADIUS) continue;
          tower.unlocked = true;
          tower.unlockedBy = player.name;
          zone.send('towers', zone.towers);
          zone.send('tower:unlocked', { id: tower.id, name: tower.name, x: tower.x, y: tower.y, by: player.name });
          ctx.applyXp(player, XP_TOWER);
          ctx.persistPlayer(player);
          break;
        }
      }
    });
  }
};

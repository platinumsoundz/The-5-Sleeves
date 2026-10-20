// Safe-city services: merchants, selling loot, gear bonuses and the Arena
// Master. Every haven has physical NPCs stored on its simulation.
const { SHOP_ITEMS, DEFAULT_INVENTORY, DEFAULT_EQUIPPED, itemById, gearAtkFor } = require('../shop-catalog.js');

const INTERACT_RADIUS = 78;
const SHOP_RADIUS = 120;
const ARENA_OPTIONS = [
  { id: 'arena-pvp', name: 'PvP · Domination', alignment: 'pvp', mode: 'domination' },
  { id: 'arena-pvp-tdm', name: 'PvP · Team Deathmatch', alignment: 'pvp', mode: 'tdm' },
  { id: 'arena-pvp-tower', name: 'PvP · Capture the Tower', alignment: 'pvp', mode: 'tower' },
  { id: 'arena-pve', name: 'PvE · Domination', alignment: 'pve', mode: 'domination' },
  { id: 'arena-pve-tdm', name: 'PvE · Warden Hunt', alignment: 'pve', mode: 'tdm' },
  { id: 'arena-pve-tower', name: 'PvE · Capture the Tower', alignment: 'pve', mode: 'tower' }
];

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
    credits: player.credits || 0,
    gearAtk: player.gearAtk || 0
  };
}

function recalcGear(player) {
  player.gearAtk = gearAtkFor(player.equipped);
}

module.exports = {
  name: 'hub-services',
  summary: 'City merchants, loot selling, Arena Master and gear bonuses.',
  priority: 20,
  setup(ctx) {
    ctx.on('joining', (player, profile) => {
      const stored = Array.isArray(profile.inventory) ? profile.inventory.filter(itemById) : null;
      // A saved empty pack stays empty; only legacy profiles with no inventory
      // field receive the starter kit again.
      player.inventory = stored ? stored : DEFAULT_INVENTORY.slice();
      player.equipped = { ...DEFAULT_EQUIPPED, ...(profile.equipped || {}) };
      for (const slot of Object.keys(player.equipped)) {
        if (!itemById(player.equipped[slot])) player.equipped[slot] = DEFAULT_EQUIPPED[slot] || null;
      }
      player.credits = Number.isFinite(profile.credits) ? Math.max(0, Math.round(profile.credits)) : 35;
      recalcGear(player);
    });

    ctx.on('persist', (player, record) => {
      record.inventory = player.inventory || [];
      record.equipped = player.equipped || {};
      record.credits = Math.max(0, Math.round(player.credits || 0));
    });

    function announce(player, socket) {
      const zone = ctx.playerZone(player.id);
      if (!zone) return;
      socket.emit('hub:state', {
        zoneId: zone.id,
        kind: zone.kind,
        mode: zone.mode,
        arena: !!zone.arena,
        arenaMode: zone.arenaMode,
        alignment: zone.alignment,
        friendlyFire: zone.friendlyFire !== false,
        danger: zone.danger,
        levelBand: zone.levelBand,
        towerIndex: zone.towerIndex,
        towerName: zone.towerName,
        havenId: zone.havenId,
        exits: zone.exits,
        spawn: zone.spawn,
        safe: zone.safe || null,
        npcs: zone.npcs || [],
        towerRun: zone.towerRun || null,
        credits: player.credits || 0,
        gearAtk: player.gearAtk || 0,
        homeCity: player.homeCity,
        unlockedCities: player.unlockedCities || []
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
      if (npc.kind === 'arena') {
        socket.emit('arena:menu', {
          name: npc.name,
          note: 'Choose a PvP or PvE minigame. Death returns you to your last city.',
          options: ARENA_OPTIONS
        });
      }
    });

    ctx.registerSocket('arena:enter', (player, payload, socket) => {
      if (!player || player.hp <= 0) return;
      const option = ARENA_OPTIONS.find((entry) => entry.id === payload?.zoneId || (entry.alignment === payload?.alignment && entry.mode === payload?.mode));
      const zone = option && ctx.zones()[option.id];
      if (!option || !zone) {
        socket.emit('hub:notice', 'That arena is not accepting fighters.');
        return;
      }
      ctx.travel(player, zone.id, 'center');
      socket.emit('hub:notice', option.name + ' — fight!');
    });

    ctx.registerSocket('shop:buy', (player, payload, socket) => {
      if (!player) return;
      const item = itemById(payload?.itemId);
      const zone = ctx.playerZone(player.id);
      if (!item || !zone || zone.kind !== 'haven') return;
      const shop = nearestNpc(zone, player);
      if (!shop || shop.kind !== 'shop' || Math.hypot(shop.x - player.x, shop.y - player.y) > SHOP_RADIUS) {
        socket.emit('shop:error', 'Stand at the merchant stall to trade.');
        return;
      }
      if ((player.inventory || []).includes(item.id)) {
        socket.emit('shop:error', 'That item is already in your pack. You can sell it here.');
        return;
      }
      if ((player.credits || 0) < item.price) {
        socket.emit('shop:error', 'Not enough credits (' + item.price + ' needed).');
        return;
      }
      player.credits -= item.price;
      player.inventory.push(item.id);
      if (item.slot !== 'supply' && player.equipped && !player.equipped[item.slot]) player.equipped[item.slot] = item.id;
      recalcGear(player);
      ctx.persistPlayer(player);
      socket.emit('shop:update', shopPayload(player));
      zone.broadcast();
    });

    ctx.registerSocket('shop:sell', (player, payload, socket) => {
      if (!player) return;
      const item = itemById(payload?.itemId);
      const zone = ctx.playerZone(player.id);
      if (!item || !zone || zone.kind !== 'haven') return;
      const shop = nearestNpc(zone, player);
      if (!shop || shop.kind !== 'shop' || Math.hypot(shop.x - player.x, shop.y - player.y) > SHOP_RADIUS) {
        socket.emit('shop:error', 'Stand at the merchant stall to trade.');
        return;
      }
      const index = (player.inventory || []).indexOf(item.id);
      if (index < 0) {
        socket.emit('shop:error', 'That item is not in your pack.');
        return;
      }
      player.inventory.splice(index, 1);
      for (const [slot, equipped] of Object.entries(player.equipped || {})) {
        if (equipped === item.id) player.equipped[slot] = null;
      }
      player.credits = (player.credits || 0) + item.sell;
      recalcGear(player);
      ctx.persistPlayer(player);
      socket.emit('shop:update', shopPayload(player));
      socket.emit('hub:notice', 'Sold ' + item.name + ' for ' + item.sell + ' credits.');
      zone.broadcast();
    });

    ctx.registerSocket('player:equip', (player, payload, socket) => {
      const item = itemById(payload?.itemId);
      if (!player || !item || item.slot === 'supply' || !(player.inventory || []).includes(item.id)) return;
      player.equipped = player.equipped || {};
      player.equipped[item.slot] = item.id;
      recalcGear(player);
      ctx.persistPlayer(player);
      socket.emit('shop:update', shopPayload(player));
      ctx.playerZone(player.id)?.broadcast();
    });
  }
};

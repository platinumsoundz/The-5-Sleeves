// Operative social services: friends list, inbox and inventory gifts. These
// are global (friends may be in another zone) while the inbox itself is part
// of the persisted profile.
const { itemById } = require('../shop-catalog.js');

function giftId() { return 'gift-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6); }
function welcomeInbox() {
  return [{
    id: 'system-welcome',
    from: 'Tower Command',
    subject: 'Welcome to the Conduit',
    body: 'Quartermaster Vale has logged you as active. Take this repair kit.',
    itemId: 'repair-kit',
    at: Date.now(),
    claimed: false,
    system: true
  }];
}

module.exports = {
  name: 'social-services',
  summary: 'Friends list, inbox rewards and inventory gifting.',
  priority: 30,
  setup(ctx) {
    ctx.on('joining', (player, profile) => {
      player.friends = Array.isArray(profile.friends) ? profile.friends.slice() : [];
      player.inbox = Array.isArray(profile.inbox) ? profile.inbox.slice() : welcomeInbox();
    });

    ctx.on('persist', (player, record) => {
      record.friends = player.friends || [];
      record.inbox = player.inbox || [];
    });

    function announce(player, socket) {
      socket.emit('friends:state', player.friends || []);
      socket.emit('inbox:update', player.inbox || []);
    }
    ctx.on('joined', announce);

    ctx.registerSocket('friends:add', (player, payload, socket) => {
      if (!player) return;
      const roster = ctx.players();
      const target = roster[payload?.targetId] || Object.values(roster).find((candidate) => candidate.name?.toLowerCase() === String(payload?.name || '').toLowerCase());
      if (!target || target.id === player.id) { socket.emit('friends:error', 'That operative is unavailable.'); return; }
      if (!player.friends.some((friend) => friend.id === target.id)) {
        player.friends.push({ id: target.id, name: target.name, zoneId: target.zoneId });
        ctx.persistPlayer(player);
      }
      // Mutual where possible so both lists stay useful.
      if (Array.isArray(target.friends) && !target.friends.some((friend) => friend.id === player.id)) {
        target.friends.push({ id: player.id, name: player.name, zoneId: player.zoneId });
        ctx.persistPlayer(target);
      }
      socket.emit('friends:state', player.friends);
      ctx.playerSockets()[target.id]?.emit('friends:state', target.friends || []);
      socket.emit('hub:notice', target.name + ' added to your friend list.');
    });

    ctx.registerSocket('friends:remove', (player, payload, socket) => {
      if (!player || !Array.isArray(player.friends)) return;
      player.friends = player.friends.filter((friend) => friend.id !== payload?.targetId);
      ctx.persistPlayer(player);
      socket.emit('friends:state', player.friends);
    });

    ctx.registerSocket('gift:send', (player, payload, socket) => {
      if (!player || !Array.isArray(player.inventory)) return;
      const roster = ctx.players();
      const target = roster[payload?.targetId];
      const item = itemById(payload?.itemId);
      if (!target || target.id === player.id || !item) { socket.emit('gift:error', 'Gift could not be delivered.'); return; }
      const index = player.inventory.indexOf(item.id);
      if (index < 0) { socket.emit('gift:error', 'That item is no longer in your inventory.'); return; }
      if (player.equipped?.[item.slot] === item.id) player.equipped[item.slot] = null;
      player.inventory.splice(index, 1);
      target.inbox = Array.isArray(target.inbox) ? target.inbox : [];
      target.inbox.unshift({
        id: giftId(), from: player.name, fromId: player.id,
        subject: 'Gift from ' + player.name, body: 'A gift delivered through the Conduit.',
        itemId: item.id, at: Date.now(), claimed: false, system: false
      });
      ctx.persistPlayer(player);
      ctx.persistPlayer(target);
      socket.emit('gift:sent', { targetName: target.name, itemName: item.name });
      ctx.playerSockets()[target.id]?.emit('inbox:update', target.inbox);
      ctx.playerSockets()[target.id]?.emit('hub:notice', player.name + ' sent you ' + item.name + '.');
      ctx.playerZone(player.id)?.broadcast();
    });

    ctx.registerSocket('inbox:claim', (player, payload, socket) => {
      if (!player || !Array.isArray(player.inbox)) return;
      const entry = player.inbox.find((message) => message.id === payload?.entryId && !message.claimed);
      if (!entry) return;
      const item = itemById(entry.itemId);
      if (item && !(player.inventory || []).includes(item.id)) player.inventory.push(item.id);
      entry.claimed = true;
      entry.claimedAt = Date.now();
      ctx.persistPlayer(player);
      ctx.playerZone(player.id)?.broadcast();
      socket.emit('inbox:update', player.inbox);
      socket.emit('hub:notice', item ? 'Claimed ' + item.name + ' from your inbox.' : 'Inbox message archived.');
    });
  }
};

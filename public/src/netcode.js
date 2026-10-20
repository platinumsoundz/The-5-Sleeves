import { createTrackStore, pruneStore, recordSample } from './interpolation.js';

export function createNetcode(state, callbacks = {}, audio = null) {
  const socketFactory = window.io;
  if (typeof socketFactory !== 'function') throw new Error('Socket.io client did not load.');
  const socket = socketFactory();
  state.socket = socket;
  const playerTracks = createTrackStore();
  const projectileTracks = createTrackStore();
  state.tracks = { players: playerTracks, projectiles: projectileTracks };

  socket.on('connect', () => callbacks.status?.('Connected to the Conduit', true));
  socket.on('server:welcome', (data) => {
    state.playerId = data.playerId;
    state.world = data.world || state.world;
    state.core = data.core || state.core;
    callbacks.welcome?.(data);
  });
  socket.on('join:accepted', (data) => {
    state.zone = data.zone || state.zone;
    callbacks.joinAccepted?.(data);
  });
  socket.on('zone:changed', (payload) => {
    const next = payload?.zone || {};
    state.zone = {
      ...(state.zone || {}), ...next,
      mode: payload?.mode || next.mode || state.zoneMode,
      arena: payload ? !!payload.arena : !!next.arena,
      friendlyFire: payload?.friendlyFire !== false
    };
    state.zoneMode = payload?.mode || next.mode || state.zoneMode;
    if (next.kind !== 'tower') state.towerRun = null;
    // Clear city-only overlays immediately when leaving a safe city; waiting
    // for hub:state would leave a one-frame stale safe cube in the wilds.
    const safe = next.kind === 'haven' ? (next.safe || null) : null;
    state.hub = safe;
    state.safeZone = safe;
    if (next.kind !== 'haven') state.npcs = [];
    callbacks.zoneChanged?.(payload);
  });
  socket.on('hub:state', (payload) => {
    state.hub = payload?.safe || null;
    state.safeZone = payload?.safe || null;
    state.npcs = payload?.npcs || [];
    state.towers = payload?.towers || [];
    state.zoneMode = payload?.mode || state.zoneMode;
    state.friendlyFire = payload?.friendlyFire !== false;
    state.towerRun = payload?.towerRun || null;
    state.zone = { ...(state.zone || {}), ...(payload?.kind ? {
      kind: payload.kind, arena: !!payload.arena, arenaMode: payload.arenaMode,
      alignment: payload.alignment, danger: payload.danger, levelBand: payload.levelBand,
      towerIndex: payload.towerIndex, towerName: payload.towerName, havenId: payload.havenId,
      exits: payload.exits, safe: payload.safe || null
    } : {}) };
    callbacks.hubState?.(payload);
  });
  socket.on('world:map', (map) => {
    state.worldMap = map || [];
    callbacks.worldMap?.(state.worldMap);
  });
  socket.on('arena:menu', (payload) => callbacks.arenaMenu?.(payload));
  socket.on('tower:state', (payload) => {
    state.towerRun = payload || null;
    callbacks.towerState?.(payload);
  });
  socket.on('tower:cleared', (payload) => callbacks.towerCleared?.(payload));
  socket.on('city:unlocked', (payload) => callbacks.cityUnlocked?.(payload));
  socket.on('travel:error', (message) => callbacks.notice?.(message));
  socket.on('hub:notice', (message) => callbacks.notice?.(message));
  socket.on('towers', (towers) => { state.towers = towers || []; });
  socket.on('tower:unlocked', (payload) => callbacks.towerUnlocked?.(payload));
  socket.on('shop:open', (payload) => callbacks.shop?.(payload));
  socket.on('shop:update', (payload) => callbacks.shop?.(payload));
  socket.on('shop:error', (message) => callbacks.shopError?.(message));
  socket.on('friends:state', (friends) => { state.friends = friends || []; callbacks.friends?.(state.friends); });
  socket.on('friends:error', (message) => callbacks.notice?.(message));
  socket.on('inbox:update', (inbox) => { state.inbox = inbox || []; callbacks.inbox?.(state.inbox); });
  socket.on('gift:sent', (payload) => callbacks.giftSent?.(payload));
  socket.on('gift:error', (message) => callbacks.notice?.(message));
  socket.on('skill:update', (payload) => callbacks.skillUpdate?.(payload));
  socket.on('skill:error', (message) => callbacks.notice?.(message));
  socket.on('zones:lobby', (zones) => {
    state.zones = zones || [];
    callbacks.zonesLobby?.(state.zones);
  });
  socket.on('spectate:accepted', (payload) => {
    state.zone = payload?.zone || state.zone;
    callbacks.spectate?.(payload);
  });
  socket.on('name_taken', (data) => callbacks.joinError?.(data?.message || 'Name already taken! Choose another name.'));
  socket.on('name_error', (data) => callbacks.joinError?.(data?.message || 'Enter a valid character name.'));
  socket.on('players', (nextPlayers) => {
    const previous = state.players || {};
    const now = performance.now();
    for (const [id, player] of Object.entries(nextPlayers || {})) {
      if (id === state.playerId) continue;
      recordSample(playerTracks, id, now, player.x, player.y);
      const before = previous[id];
      if (!before) continue;
      if (Math.hypot(player.x - before.x, player.y - before.y) > 90) audio?.play('dash');
      if (player.shieldUntil > before.shieldUntil && player.shieldUntil > Date.now()) audio?.play('shield');
    }
    pruneStore(playerTracks, new Set(Object.keys(nextPlayers || {})), 3000, now);
    state.players = nextPlayers || {};
    const serverPlayer = state.players[state.playerId];
    if (serverPlayer) {
      if (!state.localPlayer) state.localPlayer = { ...serverPlayer };
      else Object.assign(state.localPlayer, serverPlayer, { x: state.localPlayer.x, y: state.localPlayer.y });
      callbacks.playerUpdate?.(state.localPlayer);
    }
  });
  socket.on('projectiles', (nextProjectiles) => {
    const previous = state.projectiles || {};
    const now = performance.now();
    for (const [id, projectile] of Object.entries(nextProjectiles || {})) {
      if (!previous[id] && projectile.ownerId !== state.playerId) audio?.play('attack');
      recordSample(projectileTracks, id, now, projectile.x, projectile.y);
    }
    pruneStore(projectileTracks, new Set(Object.keys(nextProjectiles || {})), 1500, now);
    state.projectiles = nextProjectiles || {};
  });
  socket.on('archive:echoes', (echoes) => { state.archiveEchoes = echoes || {}; });
  socket.on('archive:terminals', (payload) => {
    state.terminals = payload?.terminals || [];
    state.terminalsRead = payload?.read || [];
  });
  socket.on('archive:terminal', (payload) => callbacks.terminal?.(payload));
  socket.on('ai', (nextAi) => { state.ai = nextAi || {}; });
  socket.on('objectives', (payload) => { state.objectives = payload || { nodes: {}, scores: {}, match: {} }; });
  socket.on('objectives:captured', (capture) => callbacks.captured?.(capture));
  socket.on('match:end', (result) => callbacks.matchEnd?.(result));
  socket.on('match:reset', (result) => callbacks.matchReset?.(result));
  socket.on('effects', (nextEffects) => { state.effects = nextEffects || {}; });
  socket.on('bursts', (nextBursts) => {
    const previous = state.bursts || {};
    for (const [id, burst] of Object.entries(nextBursts || {})) if (!previous[id]) callbacks.burst?.(burst);
    state.bursts = nextBursts || {};
  });
  socket.on('combat:hit', (hit) => callbacks.hit?.(hit));
  socket.on('combat:down', (down) => callbacks.down?.(down));
  socket.on('combat:respawn', (respawn) => callbacks.respawn?.(respawn));
  socket.on('combat:kill', (kill) => callbacks.kill?.(kill));
  socket.on('level:up', (level) => callbacks.levelUp?.(level));
  socket.on('archive:collected', (data) => {
    audio?.play('pickup');
    callbacks.archiveCollected?.(data);
  });
  socket.on('party:state', (party) => {
    state.party = party;
    callbacks.partyState?.(party);
  });
  socket.on('party:invite', (invite) => callbacks.partyInvite?.(invite));
  socket.on('party:invite:sent', (data) => callbacks.partyNotice?.('Squad invite sent to ' + data.targetName + '.'));
  socket.on('party:notice', (message) => callbacks.partyNotice?.(message));
  socket.on('party:error', (message) => callbacks.partyError?.(message));
  socket.on('party:reward', (reward) => callbacks.partyReward?.(reward));
  socket.on('chat:message', (message) => callbacks.chatMessage?.(message));
  socket.on('chat:error', (message) => callbacks.chatError?.(message));
  socket.on('player:position', (position) => {
    if (state.localPlayer) Object.assign(state.localPlayer, position);
  });
  socket.on('disconnect', () => callbacks.status?.('Connection lost', false));

  return {
    join: (name, zoneId) => socket.emit('player:join', zoneId ? { name, zone: zoneId } : name),
    switchZone: (zoneId) => socket.emit('zone:switch', zoneId),
    spectate: (zoneId) => socket.emit('spectate:join', { zone: zoneId }),
    move: (x, y) => socket.emit('player:move', { x, y }),
    action: (name, direction) => {
      if (name === 'attack') socket.emit('player:attack', direction);
      if (name === 'dash') socket.emit('player:dash', direction);
      if (name === 'shield') socket.emit('player:shield');
      if (name === 'ability') socket.emit('player:ability', direction);
      if (name === 'interact') socket.emit('player:interact');
    },
    upgrade: (stat) => socket.emit('player:upgrade', stat),
    selectDomain: (domain) => socket.emit('player:color', domain),
    invitePlayer: (playerId) => socket.emit('party:invite:send', playerId),
    respondParty: (inviteId, accept) => socket.emit('party:respond', { inviteId, accept }),
    leaveParty: () => socket.emit('party:leave'),
    sendChat: (channel, text) => socket.emit('chat:send', { channel, text }),
    buyItem: (itemId) => socket.emit('shop:buy', { itemId }),
    sellItem: (itemId) => socket.emit('shop:sell', { itemId }),
    equipItem: (itemId) => socket.emit('player:equip', { itemId }),
    enterArena: (zoneId) => socket.emit('arena:enter', { zoneId }),
    fastTravel: (zoneId) => socket.emit('city:travel', { zoneId }),
    addFriend: (targetId, name) => socket.emit('friends:add', { targetId, name }),
    removeFriend: (targetId) => socket.emit('friends:remove', { targetId }),
    sendGift: (targetId, itemId) => socket.emit('gift:send', { targetId, itemId }),
    claimInbox: (entryId) => socket.emit('inbox:claim', { entryId }),
    unlockSkill: (nodeId) => socket.emit('player:skill', { nodeId })
  };
}

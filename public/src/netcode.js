export function createNetcode(state, callbacks = {}) {
  const socketFactory = window.io;
  if (typeof socketFactory !== 'function') throw new Error('Socket.io client did not load.');
  const socket = socketFactory();
  state.socket = socket;

  socket.on('connect', () => callbacks.status?.('Connected to the Conduit', true));
  socket.on('server:welcome', (data) => {
    state.playerId = data.playerId;
    state.world = data.world || state.world;
    state.core = data.core || state.core;
    callbacks.welcome?.(data);
  });
  socket.on('join:accepted', (data) => callbacks.joinAccepted?.(data));
  socket.on('name_taken', (data) => callbacks.joinError?.(data?.message || 'Name already taken! Choose another name.'));
  socket.on('name_error', (data) => callbacks.joinError?.(data?.message || 'Enter a valid character name.'));
  socket.on('players', (players) => {
    state.players = players || {};
    const serverPlayer = state.players[state.playerId];
    if (serverPlayer) {
      if (!state.localPlayer) state.localPlayer = { ...serverPlayer };
      else Object.assign(state.localPlayer, serverPlayer, { x: state.localPlayer.x, y: state.localPlayer.y });
      callbacks.playerUpdate?.(state.localPlayer);
    }
  });
  socket.on('projectiles', (projectiles) => { state.projectiles = projectiles || {}; });
  socket.on('player:position', (position) => {
    if (state.localPlayer) Object.assign(state.localPlayer, position);
  });
  socket.on('disconnect', () => callbacks.status?.('Connection lost', false));

  return {
    join: (name) => socket.emit('player:join', name),
    move: (x, y) => socket.emit('player:move', { x, y }),
    action: (name, direction) => {
      if (name === 'attack') socket.emit('player:attack', direction);
      if (name === 'dash') socket.emit('player:dash', direction);
      if (name === 'shield') socket.emit('player:shield');
    },
    upgrade: (stat) => socket.emit('player:upgrade', stat),
    selectDomain: (domain) => socket.emit('player:color', domain)
  };
}

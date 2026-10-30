import { CORE_DEFAULT, MOVE_SPEED, PERIMETER_MARGIN, SEND_INTERVAL, WORLD_DEFAULT } from './src/config.js';
import { createCamera, addShake, screenToWorld, setZoomScale } from './src/camera.js';
import { createInputManager } from './src/inputManager.js';
import { autoAimVector, getShootingMode, normalizeAim, SHOOTING_MODE } from './src/shooting.js';
import { createAudioManager } from './src/audioManager.js';
import { createNetcode } from './src/netcode.js';
import { renderFrame } from './src/renderer.js';
import { createUIManager } from './src/uiManager.js';
import { bus } from './src/plugin-host.js';
import { loadClientModules } from './src/module-runner.js';

const canvas = document.getElementById('gameCanvas');
const context = canvas.getContext('2d');
const state = {
  playerId: null,
  world: WORLD_DEFAULT,
  core: CORE_DEFAULT,
  camera: createCamera(),
  players: {},
  projectiles: {},
  ai: {},
  effects: {},
  bursts: {},
  localPlayer: null,
  archiveEchoes: {},
  party: null,
  friends: [],
  inbox: [],
  hub: null,
  safeZone: null,
  npcs: [],
  towers: [],
  worldMap: [],
  towerRun: null,
  zoneMode: 'wasteland',
  friendlyFire: true,
  killFeed: [],
  hitMarks: [],
  objectives: { nodes: {}, scores: {}, match: {} },
  banner: null,
  lastAim: { x: 1, y: 0 }
};

let ui;
let input;
let mousePosition = null;
const audio = createAudioManager(document.getElementById('mute-button'));
const network = createNetcode(state, {
  status: (message, connected) => ui?.setStatus(message, connected),
  joinAccepted: (payload) => ui?.joinAccepted(payload),
  authenticated: (payload) => ui?.authenticated(payload),
  zonesLobby: (zones) => ui?.renderZones(zones, selectedZone),
  joinError: (message) => ui?.joinError(message),
  playerUpdate: (player) => ui?.updatePlayer(player),
  archiveCollected: (data) => ui?.showArchiveToast(data.lore),
  partyState: (party) => ui?.updateParty(party),
  partyInvite: (invite) => ui?.showPartyInvite(invite),
  partyNotice: (message) => ui?.partyNotice(message),
  partyError: (message) => ui?.partyError(message),
  partyReward: (reward) => ui?.partyReward(reward),
  kill: (kill) => {
    bus.emit('net:kill', kill);
    const label = kill.sourceName ? kill.sourceName + ' destroyed ' + kill.name : kill.name + ' was destroyed';
    state.killFeed.push({ text: label, xp: kill.xp || 0, at: performance.now(), color: kill.sourceId === state.playerId ? '#8effa1' : '#ffd9a0' });
    if (state.killFeed.length > 5) state.killFeed.shift();
    if (kill.sourceId === state.playerId) audio?.play('hit');
  },
  captured: (capture) => {
    state.killFeed.push({ text: (capture.faction || '').toUpperCase() + ' captured ' + capture.name, xp: capture.xp || 0, at: performance.now(), color: capture.color || '#8ce0ff' });
    if (state.killFeed.length > 5) state.killFeed.shift();
    state.banner = { text: (capture.faction || '').toUpperCase() + ' HOLDS THE ' + (capture.name || '').toUpperCase(), color: capture.color || '#8ce0ff', at: performance.now(), ttl: 2600 };
    audio?.play('capture');
  },
  matchEnd: (result) => {
    state.banner = { text: (result.faction || '').toUpperCase() + ' DOMINATES THE TOWER', color: result.color || '#8ce0ff', at: performance.now(), ttl: 6000 };
    audio?.play('levelup');
  },
  matchReset: (result) => {
    state.banner = { text: result?.message || 'THE TOWER RECALIBRATES', color: '#cfefff', at: performance.now(), ttl: 3000 };
  },
  levelUp: (level) => {
    const mine = level.playerId === state.playerId;
    state.banner = { text: (level.name || 'OPERATIVE').toUpperCase() + ' REACHED LEVEL ' + level.level, color: level.color || '#8ce0ff', at: performance.now(), ttl: 3400 };
    state.killFeed.push({ text: 'LEVEL ' + level.level + ' · ' + (level.name || 'operative') + ' gains a Skill Point', at: performance.now(), color: '#ffe9a0' });
    if (state.killFeed.length > 5) state.killFeed.shift();
    if (mine) audio?.play('levelup');
  },
  chatMessage: (message) => ui?.chatMessage(message),
  chatError: (message) => ui?.chatError(message),
  zoneChanged: (payload) => ui?.zoneChanged(payload),
  hubState: () => ui?.hubState(),
  worldMap: () => ui?.worldMapChanged?.(),
  arenaMenu: (payload) => ui?.showArenaMenu(payload),
  towerState: (payload) => { state.towerRun = payload; },
  towerCleared: (payload) => {
    bus.emit('net:tower-cleared', payload);
    state.banner = { text: (payload.name || 'TOWER') + ' ONLINE', color: '#7dffd8', at: performance.now(), ttl: 4200 };
    state.killFeed.push({ text: 'TOWER CLEARED', at: performance.now(), color: '#ffe9a0' });
    if (state.killFeed.length > 5) state.killFeed.shift();
    ui?.notice((payload.name || 'Tower') + ' online.');
    audio?.play('levelup');
  },
  cityUnlocked: (payload) => ui?.notice('Spawn point unlocked: ' + payload.name + '.'),
  towerUnlocked: (tower) => ui?.towerUnlocked(tower),
  shop: (payload) => ui?.showShop(payload),
  shopUpdate: (payload) => ui?.shopUpdate(payload),
  shopError: (message) => ui?.shopError(message),
  friends: () => ui?.friendsChanged(),
  inbox: () => ui?.inboxChanged(),
  giftSent: (payload) => ui?.giftSent(payload),
  skillUpdate: (payload) => ui?.skillUpdated(payload),
  notice: (message) => ui?.notice(message),
  // Forwarded onto the module bus so plug-and-play modules can react.
  terminal: (payload) => bus.emit('net:terminal', payload),
  hit: (hit) => bus.emit('net:hit', hit),
  down: (down) => bus.emit('net:down', down),
  respawn: (info) => bus.emit('net:respawn', info),
  burst: (burst) => {
    bus.emit('net:burst', burst);
    const player = state.localPlayer;
    if (!player) return;
    const away = Math.hypot(burst.x - player.x, burst.y - player.y);
    if (away < 420) addShake(state.camera, Math.min(10, (1 - away / 420) * 10));
  }
}, audio);
let selectedZone = 'haven-perimeter';
ui = createUIManager({
  join: (name, faction, mode) => network.join(name, selectedZone, faction, mode),
  authenticate: (mode, username, password) => network.authenticate(mode, username, password),
  selectZone: (zoneId) => {
    selectedZone = zoneId;
    ui.renderZones(state.zones || [], selectedZone);
  },
  upgrade: (stat) => network.upgrade(stat),
  selectDomain: (domain) => network.selectDomain(domain),
  setPalette: (palette) => network.setPalette(palette),
  toggleMenu: (open) => ui.toggleMenu(open),
  switchZone: (zoneId) => network.switchZone(zoneId),
  enterArena: (zoneId) => network.enterArena(zoneId),
  fastTravel: (zoneId) => network.fastTravel(zoneId),
  getPlayer: () => state.players[state.playerId] || state.localPlayer,
  getState: () => state,
  getWorld: () => state.world,
  leaveParty: () => network.leaveParty(),
  invitePlayer: (playerId) => network.invitePlayer(playerId),
  sendChat: (channel, text) => network.sendChat(channel, text),
  respondParty: (inviteId, accept) => network.respondParty(inviteId, accept),
  buyItem: (itemId) => network.buyItem(itemId),
  sellItem: (itemId) => network.sellItem(itemId),
  equipItem: (itemId) => network.equipItem(itemId),
  unequipItem: (slot) => network.unequipItem(slot),
  addFriend: (targetId, name) => network.addFriend(targetId, name),
  removeFriend: (targetId) => network.removeFriend(targetId),
  sendGift: (targetId, itemId) => network.sendGift(targetId, itemId),
  claimInbox: (entryId) => network.claimInbox(entryId),
  unlockSkill: (nodeId) => network.unlockSkill(nodeId),
  toggleSfx: () => audio.toggleMute(),
  isMuted: () => audio.isMuted(),
  exitToTitle: () => window.location.reload()
});

function performAction(action) {
  const movement = input?.vector() || state.lastAim;
  let aim = movement.x || movement.y ? movement : state.lastAim;
  if (action === 'attack') {
    if (getShootingMode() === SHOOTING_MODE.AUTO) aim = autoAimVector(state) || aim;
    else aim = input?.aimVector?.() || state.lastAim || aim;
  }
  if (aim?.x || aim?.y) state.lastAim = aim;
  bus.emit('action', action, aim);
  network.action(action, aim);
}
input = createInputManager({
  onAction: performAction,
  onMenu: (open) => ui.toggleMenu(open),
  onMode: (mode) => ui.setInputMode(mode),
  getMouseAim: mouseAimVector,
  audio
});

let lastFrame = 0;
let lastPositionSend = 0;
let guildPaused = false;
const GUILD_GAME_ID = 'the-5-sleeves-2d';
let guildParentOrigin = null;
try { if (window.parent !== window && document.referrer) guildParentOrigin = new URL(document.referrer).origin; } catch { guildParentOrigin = null; }
function setGuildPaused(value) {
  guildPaused = !!value;
  input?.setPaused(guildPaused);
}
if (guildParentOrigin && window.parent !== window) {
  window.addEventListener('message', (event) => {
    if (event.source !== window.parent || event.origin !== guildParentOrigin) return;
    const message = event.data;
    if (!message || message.channel !== 'guild.5-sleeves' || message.version !== 1 || message.game !== GUILD_GAME_ID) return;
    if (message.command !== 'pause' && message.command !== 'resume') return;
    setGuildPaused(message.command === 'pause');
    if (typeof message.requestId === 'string') {
      window.parent.postMessage({ channel: 'guild.5-sleeves', version: 1, game: GUILD_GAME_ID, type: 'ack', command: message.command, requestId: message.requestId }, guildParentOrigin);
    }
  });
  window.parent.postMessage({ channel: 'guild.5-sleeves', version: 1, game: GUILD_GAME_ID, type: 'ready' }, guildParentOrigin);
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') setGuildPaused(true);
  else if (window.parent === window) setGuildPaused(false);
});
// Observer modes (roadmap #14): ?spectate=<zone> watches live,
// ?replay=1&zone=<zone> plays the server's rolling 60 s buffer.
const params = new URLSearchParams(window.location.search);
const spectateZone = params.get('spectate');
const replayZone = params.get('replay') ? (params.get('zone') || 'wild-perimeter') : null;
if (spectateZone || replayZone) {
  state.spectateZone = spectateZone || null;
  state.replayZone = replayZone;
  document.getElementById('title-screen')?.classList.add('hidden');
}
if (spectateZone) network.spectate(spectateZone);

function frame(time) {
  const dt = Math.min((time - lastFrame) / 1000 || 0, 0.05);
  lastFrame = time;
  if (!guildPaused) input.update();

  const direction = guildPaused ? { x: 0, y: 0 } : input.vector();
  const player = state.localPlayer;
  if (!guildPaused && player && state.playerId && player.hp > 0 && (direction.x || direction.y)) {
    state.lastAim = { ...direction };
    // Slows and hastes are resolved server-side; the client just honours them.
    const speedScale = (player.slowRemaining > 0 ? 0.55 : 1) * (player.hasteRemaining > 0 ? 1.35 : 1);
    player.x = Math.max(PERIMETER_MARGIN, Math.min(state.world.width - PERIMETER_MARGIN, player.x + direction.x * MOVE_SPEED * speedScale * dt));
    player.y = Math.max(PERIMETER_MARGIN, Math.min(state.world.height - PERIMETER_MARGIN, player.y + direction.y * MOVE_SPEED * speedScale * dt));
    player.vx = direction.x * MOVE_SPEED;
    player.vy = direction.y * MOVE_SPEED;
    state.players[state.playerId] = player;
    if (time - lastPositionSend >= SEND_INTERVAL) {
      network.move(player.x, player.y);
      lastPositionSend = time;
    }
  } else if (player) {
    player.vx = 0; player.vy = 0;
  }
  renderFrame(canvas, context, state, time);
  // Modules get one logic tick per rendered frame (dt in seconds).
  bus.emit('frame', { canvas, context, state, time, dt });
  requestAnimationFrame(frame);
}

canvas.addEventListener('pointermove', (event) => {
  if (event.pointerType === 'mouse') mousePosition = { x: event.clientX, y: event.clientY };
});

function mouseAimVector() {
  if (!mousePosition || !state.localPlayer) return null;
  const rect = canvas.getBoundingClientRect();
  const target = screenToWorld(state.camera, mousePosition.x - rect.left, mousePosition.y - rect.top, rect.width, rect.height);
  return normalizeAim(target.x - state.localPlayer.x, target.y - state.localPlayer.y);
}

canvas.addEventListener('click', (event) => {
  if (!state.playerId || !state.localPlayer) return;
  const rect = canvas.getBoundingClientRect();
  const world = screenToWorld(state.camera, event.clientX - rect.left, event.clientY - rect.top, rect.width, rect.height);
  let target = null, nearest = Infinity;
  for (const player of Object.values(state.players)) {
    if (player.id === state.playerId) continue;
    const dx = player.x - world.x, dy = player.y - world.y;
    if (Math.abs(dx) <= 60 && Math.abs(dy) <= 48 && Math.hypot(dx, dy) < nearest) {
      target = player; nearest = Math.hypot(dx, dy);
    }
  }
  if (target) network.invitePlayer(target.id);
});

function adjustZoom(delta) {
  setZoomScale(state.camera, (state.camera.zoomScale || 1) + delta);
}
canvas.addEventListener('wheel', (event) => {
  event.preventDefault();
  adjustZoom(event.deltaY > 0 ? -0.12 : 0.12);
}, { passive: false });
window.addEventListener('keydown', (event) => {
  if (event.target?.closest?.('input, textarea')) return;
  if (event.key === '+' || event.key === '=') adjustZoom(0.15);
  if (event.key === '-' || event.key === '_') adjustZoom(-0.15);
});

// Boot the plug-and-play modules; the title screen shows real progress.
loadClientModules({ state, audio, network }, (done, total, name) => {
  ui?.setBootStatus(total ? 'BOOTING SYSTEMS ' + done + '/' + total + (name ? ' · ' + name.toUpperCase() : '') : 'BOOTING SYSTEMS…');
}).then((ready) => {
  ui?.setBootStatus(ready.length ? 'SYSTEMS READY · ' + ready.length + ' MODULES' : 'READY');
}).catch(() => ui?.setBootStatus('READY'));

requestAnimationFrame(frame);

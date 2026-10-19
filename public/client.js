import { CORE_DEFAULT, MOVE_SPEED, PERIMETER_MARGIN, SEND_INTERVAL, WORLD_DEFAULT } from './src/config.js';
import { createInputManager } from './src/inputManager.js';
import { createAudioManager } from './src/audioManager.js';
import { createNetcode } from './src/netcode.js';
import { renderFrame } from './src/renderer.js';
import { createUIManager } from './src/uiManager.js';

const canvas = document.getElementById('gameCanvas');
const context = canvas.getContext('2d');
const state = {
  playerId: null,
  world: WORLD_DEFAULT,
  core: CORE_DEFAULT,
  players: {},
  projectiles: {},
  localPlayer: null,
  archiveEchoes: {},
  party: null,
  lastAim: { x: 1, y: 0 }
};

let ui;
let input;
const audio = createAudioManager(document.getElementById('mute-button'));
const network = createNetcode(state, {
  status: (message, connected) => ui?.setStatus(message, connected),
  joinAccepted: (payload) => ui?.joinAccepted(payload),
  joinError: (message) => ui?.joinError(message),
  playerUpdate: (player) => ui?.updatePlayer(player),
  archiveCollected: (data) => ui?.showArchiveToast(data.lore),
  partyState: (party) => ui?.updateParty(party),
  partyInvite: (invite) => ui?.showPartyInvite(invite),
  partyNotice: (message) => ui?.partyNotice(message),
  partyError: (message) => ui?.partyError(message),
  partyReward: (reward) => ui?.partyReward(reward),
  chatMessage: (message) => ui?.chatMessage(message),
  chatError: (message) => ui?.chatError(message)
}, audio);
ui = createUIManager({
  join: (name) => network.join(name),
  upgrade: (stat) => network.upgrade(stat),
  selectDomain: (domain) => network.selectDomain(domain),
  toggleMenu: (open) => ui.toggleMenu(open),
  getPlayer: () => state.players[state.playerId],
  getWorld: () => state.world,
  leaveParty: () => network.leaveParty(),
  sendChat: (channel, text) => network.sendChat(channel, text),
  respondParty: (inviteId, accept) => network.respondParty(inviteId, accept)
});

function performAction(action) {
  const direction = input?.vector() || state.lastAim;
  const aim = direction.x || direction.y ? direction : state.lastAim;
  network.action(action, aim);
}
input = createInputManager({
  onAction: performAction,
  onMenu: (open) => ui.toggleMenu(open),
  onMode: (mode) => ui.setInputMode(mode),
  audio
});

let lastFrame = 0;
let lastPositionSend = 0;
function frame(time) {
  const dt = Math.min((time - lastFrame) / 1000 || 0, 0.05);
  lastFrame = time;
  input.update();

  const direction = input.vector();
  const player = state.localPlayer;
  if (player && player.hp > 0 && (direction.x || direction.y)) {
    state.lastAim = { ...direction };
    player.x = Math.max(PERIMETER_MARGIN, Math.min(state.world.width - PERIMETER_MARGIN, player.x + direction.x * MOVE_SPEED * dt));
    player.y = Math.max(PERIMETER_MARGIN, Math.min(state.world.height - PERIMETER_MARGIN, player.y + direction.y * MOVE_SPEED * dt));
    state.players[state.playerId] = player;
    if (time - lastPositionSend >= SEND_INTERVAL) {
      network.move(player.x, player.y);
      lastPositionSend = time;
    }
  }
  renderFrame(canvas, context, state, time);
  requestAnimationFrame(frame);
}

canvas.addEventListener('click', (event) => {
  if (!state.playerId || !state.localPlayer) return;
  const rect = canvas.getBoundingClientRect();
  const scale = Math.min(rect.width / state.world.width, rect.height / state.world.height, 1);
  const offsetX = (rect.width - state.world.width * scale) / 2;
  const offsetY = (rect.height - state.world.height * scale) / 2;
  const worldX = (event.clientX - rect.left - offsetX) / scale;
  const worldY = (event.clientY - rect.top - offsetY) / scale;
  let target = null, nearest = Infinity;
  for (const player of Object.values(state.players)) {
    if (player.id === state.playerId) continue;
    const dx = player.x - worldX, dy = player.y - worldY;
    if (Math.abs(dx) <= 60 && Math.abs(dy) <= 48 && Math.hypot(dx, dy) < nearest) {
      target = player; nearest = Math.hypot(dx, dy);
    }
  }
  if (target) network.invitePlayer(target.id);
});

requestAnimationFrame(frame);

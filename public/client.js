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
  archiveCollected: (data) => ui?.showArchiveToast(data.lore)
}, audio);
ui = createUIManager({
  join: (name) => network.join(name),
  upgrade: (stat) => network.upgrade(stat),
  selectDomain: (domain) => network.selectDomain(domain),
  toggleMenu: (open) => ui.toggleMenu(open),
  getPlayer: () => state.players[state.playerId]
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

requestAnimationFrame(frame);

/* global io */
'use strict';

const canvas = document.getElementById('gameCanvas');
const context = canvas.getContext('2d');
const status = document.getElementById('status');
const socket = io();
const MOVE_SPEED = 220;
const SEND_INTERVAL = 50;

let playerId = null;
let world = { width: 1000, height: 700 };
let players = {};
let localPlayer = null;
let lastFrameTime = 0;
let lastSendTime = 0;
const heldDirections = new Set();

socket.on('connect', () => {
  status.textContent = 'Connected to the Conduit';
  status.classList.remove('offline');
});

socket.on('server:welcome', ({ message, playerId: id, world: serverWorld }) => {
  playerId = id;
  world = serverWorld;
  console.info(message, playerId);
});

socket.on('players', (nextPlayers) => {
  players = nextPlayers;
  const serverPlayer = players[playerId];
  if (serverPlayer && !localPlayer) localPlayer = { ...serverPlayer };
});

socket.on('disconnect', () => {
  status.textContent = 'Connection lost';
  status.classList.add('offline');
});

function resizeCanvas() {
  const scale = window.devicePixelRatio || 1;
  canvas.width = Math.floor(window.innerWidth * scale);
  canvas.height = Math.floor(window.innerHeight * scale);
  context.setTransform(scale, 0, 0, scale, 0, 0);
}

function setDirection(direction, isHeld) {
  if (isHeld) heldDirections.add(direction);
  else heldDirections.delete(direction);
}

document.querySelectorAll('.dpad-button').forEach((button) => {
  const direction = button.dataset.direction;
  button.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    button.classList.add('active');
    setDirection(direction, true);
  });
  const release = (event) => {
    if (event) event.preventDefault();
    button.classList.remove('active');
    setDirection(direction, false);
  };
  button.addEventListener('pointerup', release);
  button.addEventListener('pointercancel', release);
  button.addEventListener('lostpointercapture', release);
});

window.addEventListener('keydown', (event) => {
  const keys = { ArrowUp: 'up', w: 'up', ArrowDown: 'down', s: 'down', ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right' };
  const direction = keys[event.key];
  if (direction) { event.preventDefault(); setDirection(direction, true); }
});
window.addEventListener('keyup', (event) => {
  const keys = { ArrowUp: 'up', w: 'up', ArrowDown: 'down', s: 'down', ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right' };
  const direction = keys[event.key];
  if (direction) { event.preventDefault(); setDirection(direction, false); }
});

function updateLocalPlayer(deltaSeconds, time) {
  if (!localPlayer) return;
  let dx = (heldDirections.has('right') ? 1 : 0) - (heldDirections.has('left') ? 1 : 0);
  let dy = (heldDirections.has('down') ? 1 : 0) - (heldDirections.has('up') ? 1 : 0);
  if (!dx && !dy) return;

  const length = Math.hypot(dx, dy);
  dx /= length;
  dy /= length;
  localPlayer.x = Math.max(20, Math.min(world.width - 20, localPlayer.x + dx * MOVE_SPEED * deltaSeconds));
  localPlayer.y = Math.max(20, Math.min(world.height - 20, localPlayer.y + dy * MOVE_SPEED * deltaSeconds));
  players[playerId] = localPlayer;

  if (time - lastSendTime >= SEND_INTERVAL) {
    socket.emit('player:move', { x: localPlayer.x, y: localPlayer.y });
    lastSendTime = time;
  }
}

function drawGrid() {
  const tileSize = 40;
  context.strokeStyle = 'rgba(89, 151, 182, 0.16)';
  context.lineWidth = 1;
  for (let x = 0; x <= world.width; x += tileSize) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x, world.height); context.stroke(); }
  for (let y = 0; y <= world.height; y += tileSize) { context.beginPath(); context.moveTo(0, y); context.lineTo(world.width, y); context.stroke(); }
}

function drawCipherCore(time) {
  const x = world.width / 2;
  const y = world.height / 2;
  const pulse = 1 + Math.sin(time / 500) * 0.08;
  const glow = context.createRadialGradient(x, y, 8, x, y, 110 * pulse);
  glow.addColorStop(0, 'rgba(176, 255, 241, .9)');
  glow.addColorStop(.25, 'rgba(59, 224, 208, .35)');
  glow.addColorStop(1, 'rgba(59, 224, 208, 0)');
  context.fillStyle = glow; context.beginPath(); context.arc(x, y, 110 * pulse, 0, Math.PI * 2); context.fill();
  context.fillStyle = '#72ffe2'; context.beginPath(); context.arc(x, y, 20 * pulse, 0, Math.PI * 2); context.fill();
  context.fillStyle = '#edfffb'; context.beginPath(); context.arc(x, y, 8, 0, Math.PI * 2); context.fill();
}

function drawPlayer(player) {
  context.fillStyle = player.color;
  context.fillRect(player.x - 12, player.y - 12, 24, 24);
  context.strokeStyle = player.id === playerId ? '#ffffff' : '#07121a';
  context.lineWidth = 3;
  context.strokeRect(player.x - 12, player.y - 12, 24, 24);
  context.fillStyle = '#ffffff'; context.font = '12px system-ui'; context.textAlign = 'center';
  context.fillText(player.id === playerId ? 'You' : player.name, player.x, player.y - 20);
}

function render(time) {
  const deltaSeconds = Math.min((time - lastFrameTime) / 1000 || 0, 0.05);
  lastFrameTime = time;
  updateLocalPlayer(deltaSeconds, time);
  const width = window.innerWidth;
  const height = window.innerHeight;
  context.clearRect(0, 0, width, height);
  context.fillStyle = '#09111f'; context.fillRect(0, 0, width, height);
  const scale = Math.min(width / world.width, height / world.height, 1);
  context.save();
  context.translate((width - world.width * scale) / 2, (height - world.height * scale) / 2);
  context.scale(scale, scale);
  drawGrid(); drawCipherCore(time); Object.values(players).forEach(drawPlayer);
  context.restore();
  requestAnimationFrame(render);
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();
requestAnimationFrame(render);

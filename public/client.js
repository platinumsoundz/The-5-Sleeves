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
let core = { x: 500, y: 350, radius: 90 };
let players = {};
let projectiles = {};
let localPlayer = null;
let lastFrameTime = 0;
let lastSendTime = 0;
let lastAim = { x: 1, y: 0 };
const heldDirections = new Set();

socket.on('connect', () => {
  status.textContent = 'Connected to the Conduit';
  status.classList.remove('offline');
});
socket.on('server:welcome', ({ message, playerId: id, world: serverWorld, core: serverCore }) => {
  playerId = id;
  world = serverWorld;
  core = serverCore || core;
  console.info(message, playerId);
});
socket.on('players', (nextPlayers) => {
  players = nextPlayers;
  if (players[playerId]) {
    if (!localPlayer) localPlayer = { ...players[playerId] };
    else Object.assign(localPlayer, players[playerId], { x: localPlayer.x, y: localPlayer.y });
  }
});
socket.on('player:position', (position) => {
  if (localPlayer) Object.assign(localPlayer, position);
});
socket.on('projectiles', (nextProjectiles) => { projectiles = nextProjectiles; });
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

function moveVector() {
  let x = (heldDirections.has('right') ? 1 : 0) - (heldDirections.has('left') ? 1 : 0);
  let y = (heldDirections.has('down') ? 1 : 0) - (heldDirections.has('up') ? 1 : 0);
  const length = Math.hypot(x, y);
  if (length) { x /= length; y /= length; }
  return { x, y };
}

const keyMap = { ArrowUp: 'up', w: 'up', ArrowDown: 'down', s: 'down', ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right' };
window.addEventListener('keydown', (event) => {
  const direction = keyMap[event.key];
  if (direction) { event.preventDefault(); setDirection(direction, true); }
  if (event.code === 'Space') { event.preventDefault(); performAction('attack'); }
});
window.addEventListener('keyup', (event) => {
  const direction = keyMap[event.key];
  if (direction) { event.preventDefault(); setDirection(direction, false); }
});

function performAction(action) {
  if (action === 'attack') socket.emit('player:attack', moveVector().x || moveVector().y ? moveVector() : lastAim);
  if (action === 'dash') socket.emit('player:dash', moveVector().x || moveVector().y ? moveVector() : lastAim);
  if (action === 'shield') socket.emit('player:shield');
}
document.querySelectorAll('.action-button').forEach((button) => {
  button.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    performAction(button.dataset.action);
  });
});

function updateLocalPlayer(deltaSeconds, time) {
  if (!localPlayer) return;
  const direction = moveVector();
  if (!direction.x && !direction.y) return;
  lastAim = direction;
  localPlayer.x = Math.max(20, Math.min(world.width - 20, localPlayer.x + direction.x * MOVE_SPEED * deltaSeconds));
  localPlayer.y = Math.max(20, Math.min(world.height - 20, localPlayer.y + direction.y * MOVE_SPEED * deltaSeconds));
  players[playerId] = localPlayer;
  if (time - lastSendTime >= SEND_INTERVAL) {
    socket.emit('player:move', { x: localPlayer.x, y: localPlayer.y });
    lastSendTime = time;
  }
}

function drawGrid() {
  context.strokeStyle = 'rgba(89, 151, 182, 0.16)';
  context.lineWidth = 1;
  for (let x = 0; x <= world.width; x += 40) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x, world.height); context.stroke(); }
  for (let y = 0; y <= world.height; y += 40) { context.beginPath(); context.moveTo(0, y); context.lineTo(world.width, y); context.stroke(); }
}

function drawCipherCore(time) {
  const pulse = 1 + Math.sin(time / 500) * 0.08;
  context.beginPath();
  context.arc(core.x, core.y, core.radius, 0, Math.PI * 2);
  context.fillStyle = 'rgba(38, 220, 197, .08)';
  context.fill();
  context.setLineDash([9, 7]);
  context.strokeStyle = 'rgba(94,255,222,.55)';
  context.lineWidth = 2;
  context.stroke();
  context.setLineDash([]);
  const glow = context.createRadialGradient(core.x, core.y, 8, core.x, core.y, 110 * pulse);
  glow.addColorStop(0, 'rgba(176,255,241,.9)');
  glow.addColorStop(.25, 'rgba(59,224,208,.35)');
  glow.addColorStop(1, 'rgba(59,224,208,0)');
  context.fillStyle = glow;
  context.beginPath(); context.arc(core.x, core.y, 110 * pulse, 0, Math.PI * 2); context.fill();
  context.fillStyle = '#72ffe2'; context.beginPath(); context.arc(core.x, core.y, 20 * pulse, 0, Math.PI * 2); context.fill();
  context.fillStyle = '#edfffb'; context.beginPath(); context.arc(core.x, core.y, 8, 0, Math.PI * 2); context.fill();
  context.fillStyle = '#c7fff4'; context.font = 'bold 14px system-ui'; context.textAlign = 'center';
  context.fillText('CIPHER CORE', core.x, core.y + core.radius + 20);
}

function drawHealthBar(player) {
  const width = 42;
  context.fillStyle = '#311923'; context.fillRect(player.x - width / 2, player.y - 30, width, 5);
  context.fillStyle = player.hp > 35 ? '#4ef2a1' : '#ff596d';
  context.fillRect(player.x - width / 2, player.y - 30, width * Math.max(0, player.hp / player.maxHp), 5);
}
function drawPlayer(player) {
  context.fillStyle = player.color;
  context.fillRect(player.x - 12, player.y - 12, 24, 24);
  context.strokeStyle = player.id === playerId ? '#ffffff' : '#07121a';
  context.lineWidth = 3; context.strokeRect(player.x - 12, player.y - 12, 24, 24);
  if (Date.now() < player.shieldUntil) {
    context.beginPath(); context.arc(player.x, player.y, 23, 0, Math.PI * 2);
    context.strokeStyle = '#7bd8ff'; context.lineWidth = 3; context.stroke();
  }
  drawHealthBar(player);
  context.fillStyle = '#ffffff'; context.font = '12px system-ui'; context.textAlign = 'center';
  context.fillText(player.id === playerId ? 'You' : player.name, player.x, player.y - 37);
  if (player.inCore) {
    context.fillStyle = '#70ffe1'; context.font = '10px system-ui';
    context.fillText('CHARGING ' + Math.floor(player.coreCharge) + '%  •  ' + player.corePoints + ' pts', player.x, player.y + 29);
  }
  if (player.hp <= 0) {
    context.fillStyle = 'rgba(0,0,0,.7)'; context.fillRect(player.x - 14, player.y - 14, 28, 28);
    context.fillStyle = '#ff9eaa'; context.fillText('DOWN', player.x, player.y + 28);
  }
}
function drawProjectiles() {
  for (const projectile of Object.values(projectiles)) {
    context.shadowBlur = 18; context.shadowColor = projectile.color;
    context.fillStyle = '#d9ffff'; context.beginPath(); context.arc(projectile.x, projectile.y, projectile.radius, 0, Math.PI * 2); context.fill();
    context.shadowBlur = 0;
  }
}
function drawHud() {
  const me = players[playerId] || localPlayer;
  if (!me) return;
  context.save();
  context.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0);
  const x = 12;
  const y = 56;
  const width = Math.min(190, window.innerWidth - 24);
  context.fillStyle = 'rgba(8,18,31,.78)'; context.fillRect(x, y, width, 45);
  context.fillStyle = '#f25d75'; context.fillRect(x + 8, y + 8, (width - 16) * Math.max(0, me.hp / me.maxHp), 10);
  context.fillStyle = '#fff'; context.font = '11px system-ui'; context.textAlign = 'left';
  context.fillText('HP ' + Math.ceil(me.hp) + '/' + me.maxHp, x + 8, y + 31);
  context.fillStyle = '#61ffe0'; context.fillText('CORE ' + Math.floor(me.coreCharge) + '%  •  ' + me.corePoints + ' pts', x + 82, y + 31);
  context.restore();
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
  drawGrid(); drawCipherCore(time); drawProjectiles(); Object.values(players).forEach(drawPlayer);
  context.restore();
  drawHud();
  requestAnimationFrame(render);
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();
requestAnimationFrame(render);

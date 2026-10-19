/* global io */
'use strict';

const canvas = document.getElementById('gameCanvas');
const context = canvas.getContext('2d');
const status = document.getElementById('status');
const socket = io();

let playerId = null;

socket.on('connect', () => {
  status.textContent = 'Connected to the Conduit';
  status.classList.remove('offline');
});

socket.on('server:welcome', ({ message, playerId: id }) => {
  playerId = id;
  console.info(message, playerId);
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

function drawGrid(width, height) {
  const tileSize = 40;
  context.strokeStyle = 'rgba(89, 151, 182, 0.16)';
  context.lineWidth = 1;

  for (let x = 0; x <= width; x += tileSize) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, height);
    context.stroke();
  }
  for (let y = 0; y <= height; y += tileSize) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.stroke();
  }
}

function drawCipherCore(x, y, time) {
  const pulse = 1 + Math.sin(time / 500) * 0.08;
  const glow = context.createRadialGradient(x, y, 8, x, y, 110 * pulse);
  glow.addColorStop(0, 'rgba(176, 255, 241, .9)');
  glow.addColorStop(.25, 'rgba(59, 224, 208, .35)');
  glow.addColorStop(1, 'rgba(59, 224, 208, 0)');
  context.fillStyle = glow;
  context.beginPath();
  context.arc(x, y, 110 * pulse, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = '#72ffe2';
  context.beginPath();
  context.arc(x, y, 20 * pulse, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = '#edfffb';
  context.beginPath();
  context.arc(x, y, 8, 0, Math.PI * 2);
  context.fill();
}

function render(time) {
  const width = window.innerWidth;
  const height = window.innerHeight;
  context.clearRect(0, 0, width, height);
  context.fillStyle = '#09111f';
  context.fillRect(0, 0, width, height);
  drawGrid(width, height);
  drawCipherCore(width / 2, height / 2, time);

  context.fillStyle = '#c7d8e5';
  context.font = '600 16px system-ui';
  context.textAlign = 'center';
  context.fillText('CIPHER CORE', width / 2, height / 2 + 145);
  context.font = '12px system-ui';
  context.fillStyle = '#6f91a8';
  context.fillText(playerId ? 'Network link established' : 'Establishing network link…', width / 2, height / 2 + 166);

  requestAnimationFrame(render);
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();
requestAnimationFrame(render);

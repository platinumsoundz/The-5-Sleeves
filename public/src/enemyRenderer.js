import { drawSpriteFrame, optionalImage } from './assetLoader.js';

const WARDEN_SPRITE_SIZE = 40;

// Pick a compact procedural hull for small catalog enemies.
export function drawEnemy(ctx, enemy, time) {
  if (enemy.size === 'small') return drawSmallDrone(ctx, enemy, time);
  return drawWarden(ctx, enemy, time);
}

function drawSmallDrone(ctx, drone, time) {
  const radius = Math.max(5, drone.radius || 8);
  const lift = Math.sin(time * .006 + drone.x) * 1.2;
  ctx.save();
  ctx.translate(drone.x, drone.y + lift);
  ctx.rotate(Math.sin(time * .004 + drone.y) * .12);
  ctx.fillStyle = drone.color || '#718894';
  ctx.beginPath();
  ctx.moveTo(-radius - 4, 0); ctx.lineTo(-2, -radius * .55); ctx.lineTo(2, -radius * .55);
  ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(radius + 4, 0); ctx.lineTo(2, radius * .55); ctx.lineTo(-2, radius * .55);
  ctx.closePath(); ctx.fill();
  ctx.fillRect(-radius * .7, -radius * .55, radius * 1.4, radius * 1.1);
  ctx.fillStyle = drone.accentColor || '#d5e8df';
  ctx.fillRect(-2, -2, 4, 4);
  ctx.restore();
  if (drone.targetId) {
    ctx.strokeStyle = 'rgba(255,190,120,.55)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(drone.x, drone.y, radius + 6, 0, Math.PI * 2); ctx.stroke();
  }
  if (drone.hp < drone.maxHp) {
    const width = radius * 3;
    ctx.fillStyle = '#302b27'; ctx.fillRect(drone.x - width / 2, drone.y - radius - 7, width, 3);
    ctx.fillStyle = '#ffb768'; ctx.fillRect(drone.x - width / 2, drone.y - radius - 7, width * Math.max(0, drone.hp / drone.maxHp), 3);
  }
}

function drawWarden(ctx, warden, time) {
  const lift = Math.sin(time * .004 + warden.x) * 1.8;
  const drawn = drawSpriteFrame(ctx, optionalImage('assets/warden.png'), 0, 1,
    warden.x - WARDEN_SPRITE_SIZE / 2, warden.y - WARDEN_SPRITE_SIZE / 2 + lift,
    WARDEN_SPRITE_SIZE, WARDEN_SPRITE_SIZE);
  if (!drawn) {
    ctx.save();
    ctx.translate(warden.x, warden.y + lift);
    ctx.fillStyle = '#3a3d3f'; ctx.fillRect(-10, -6, 20, 12);
    ctx.fillStyle = '#4b5052'; ctx.fillRect(-7, -4, 14, 8);
    ctx.fillStyle = '#585c5e'; ctx.fillRect(-14, -8, 5, 16); ctx.fillRect(9, -8, 5, 16);
    ctx.fillStyle = '#c98b3a'; ctx.fillRect(-13, -11, 3, 3); ctx.fillRect(10, -11, 3, 3);
    ctx.fillStyle = '#ffe9c0'; ctx.fillRect(-3, -2, 6, 5);
    ctx.fillStyle = '#ff7a2a'; ctx.fillRect(-2, -1, 4, 3);
    ctx.restore();
  }
  ctx.save();
  if (warden.targetId) {
    ctx.strokeStyle = 'rgba(255,150,80,' + (0.35 + Math.sin(time * .01) * .25).toFixed(3) + ')';
    ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(warden.x, warden.y, 22, 0, Math.PI * 2); ctx.stroke();
  }
  if (warden.hp < warden.maxHp) {
    ctx.fillStyle = '#33221a'; ctx.fillRect(warden.x - 18, warden.y - 28, 36, 4);
    ctx.fillStyle = '#ffab54'; ctx.fillRect(warden.x - 18, warden.y - 28, 36 * Math.max(0, warden.hp / warden.maxHp), 4);
  }
  ctx.restore();
}

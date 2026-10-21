import { DOMAINS } from './config.js';
import { drawSpriteFrame, optionalImage } from './assetLoader.js';

// Baked sprite frames (tools/generate-sprites.js) are 36x52 with the player's
// origin at (18, 28) — the same anchor the procedural drawing uses.
const SPRITE = Object.freeze({ width: 36, height: 52, anchorX: 18, anchorY: 28 });
const WARDEN_SPRITE = Object.freeze({ size: 40 });
const WALK_FRAMES = 4;
const MOVING_THRESHOLD = 12;
const WALK_FRAMES_PER_SECOND = 6;

function drawAjaye(ctx, x, y, player, time) {
  ctx.save(); ctx.translate(x, y);
  // Front-facing view: Ajaye's anatomical left arm is screen-right; only it has the Sleeve.
  ctx.fillStyle = '#17191b'; ctx.fillRect(-8, -3, 16, 16);
  ctx.fillStyle = '#2c2d2d'; ctx.fillRect(-9, 1, 18, 4);
  ctx.fillStyle = '#0f1114'; ctx.fillRect(-7, 12, 6, 9); ctx.fillRect(2, 12, 6, 9);
  ctx.fillStyle = '#27292a'; ctx.fillRect(-8, 19, 8, 3); ctx.fillRect(1, 19, 8, 3);
  // Ordinary cloth right arm and warm skin: explicitly no Sleeve on this arm.
  ctx.fillStyle = '#252729'; ctx.fillRect(-13, -2, 5, 13); ctx.fillStyle = '#bc805f'; ctx.fillRect(-13, 9, 5, 3);
  const domain = player.energyColor || 'wind';
  const primary = player.color || DOMAINS[domain]?.primary || '#00ffff';
  // Dark segmented forearm device and cyan/selected-domain channels on anatomical left.
  ctx.fillStyle = '#151c21'; ctx.fillRect(8, -2, 6, 14);
  ctx.fillStyle = '#313f43'; ctx.fillRect(8, 2, 6, 2); ctx.fillRect(8, 7, 6, 2);
  ctx.fillStyle = primary; ctx.shadowBlur = 7; ctx.shadowColor = primary;
  ctx.fillRect(10, 0, 2, 11); ctx.fillRect(8, 4, 6, 1); ctx.shadowBlur = 0;
  // Patched charcoal scavenger clothes, utility straps, hood/scarf, curls and blue eyes.
  ctx.fillStyle = '#101316'; ctx.fillRect(-9, -9, 18, 8); ctx.fillRect(-7, -5, 14, 3);
  ctx.fillStyle = '#8b664d'; ctx.fillRect(-5, -17, 10, 9);
  ctx.fillStyle = '#674431'; ctx.fillRect(-7, -22, 14, 9);
  ctx.fillRect(-9, -19, 3, 6); ctx.fillRect(-6, -24, 4, 4); ctx.fillRect(-1, -25, 5, 4); ctx.fillRect(4, -22, 4, 5);
  ctx.fillStyle = '#b67c54'; ctx.fillRect(-6, -21, 3, 3); ctx.fillRect(-1, -23, 3, 3); ctx.fillRect(4, -20, 3, 3);
  ctx.fillStyle = '#1c83d4'; ctx.fillRect(-4, -15, 2, 2); ctx.fillRect(3, -15, 2, 2);
  ctx.fillStyle = '#151719'; ctx.fillRect(-5, -9, 10, 2);
  ctx.fillStyle = '#858078'; ctx.fillRect(-5, -2, 2, 14); ctx.fillRect(3, -1, 2, 11);
  ctx.fillStyle = '#55483b'; ctx.fillRect(-9, 5, 4, 4); ctx.fillRect(5, 6, 3, 4);
  if (domain === 'dark' && Math.sin(time * .04 + player.x) > .35) {
    ctx.fillStyle = player.accentColor || '#ff29d6'; ctx.fillRect(-10, -19, 4, 2); ctx.fillRect(8, -4, 5, 2);
  }
  ctx.restore();
}

function drawAura(ctx, player, time, color, accent) {
  const halo = ctx.createRadialGradient(player.x, player.y, 2, player.x, player.y, 38);
  halo.addColorStop(0, color + '55'); halo.addColorStop(1, color + '00');
  ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(player.x, player.y, 38, 0, Math.PI * 2); ctx.fill();
  for (let i = 0; i < 5; i += 1) {
    const angle = time * (player.energyColor === 'wind' ? .004 : .0018) + i * Math.PI * .4;
    const glitch = player.energyColor === 'dark' ? Math.sin(time * .045 + i * 17) * 5 : 0;
    const radius = 22 + glitch;
    // Every third spark wears the player's suit colour; the rest stay faction.
    ctx.fillStyle = player.palette && i % 3 === 0 ? player.palette : (i % 2 ? accent : color);
    if (player.energyColor === 'dark' && i % 2 === 0) ctx.fillRect(player.x + Math.cos(angle) * radius - 2, player.y + Math.sin(angle) * radius - 2, 5, 5);
    else { ctx.beginPath(); ctx.arc(player.x + Math.cos(angle) * radius, player.y + Math.sin(angle) * radius, 2.4, 0, Math.PI * 2); ctx.fill(); }
  }
}

// The personal palette is an overlay rather than a recolour, so it works the
// same on baked sprite sheets and on the procedural fallback: a scarf/chest
// strap, a belt line and a shoulder stud.
function drawSuitAccent(ctx, player) {
  if (!player.palette) return;
  ctx.save();
  ctx.globalAlpha = .95;
  ctx.fillStyle = player.palette;
  ctx.fillRect(player.x - 9, player.y - 12, 18, 3);
  ctx.globalAlpha = .8;
  ctx.fillRect(player.x - 5, player.y + 6, 10, 2);
  ctx.globalAlpha = .55;
  ctx.fillRect(player.x - 12, player.y - 20, 3, 3);
  ctx.restore();
}

function drawStatusEffects(ctx, player, time) {
  const now = Date.now();
  if ((player.slowRemaining || 0) > 0) {
    ctx.save();
    ctx.strokeStyle = 'rgba(140,225,255,.85)'; ctx.lineWidth = 2; ctx.setLineDash([4, 5]); ctx.lineDashOffset = time * .01;
    ctx.beginPath(); ctx.ellipse(player.x, player.y + 18, 15, 6, 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(190,240,255,.5)';
    for (let i = 0; i < 3; i += 1) {
      const angle = time * .001 + i * 2.1;
      ctx.fillRect(player.x + Math.cos(angle) * 14 - 1, player.y + 18 + Math.sin(angle) * 5 - 1, 3, 3);
    }
    ctx.restore();
  }
  if ((player.burnRemaining || 0) > 0) {
    ctx.save();
    for (let i = 0; i < 4; i += 1) {
      const flicker = Math.sin(time * .02 + i * 2.4) * 2.4;
      const x = player.x - 9 + i * 6, base = player.y - 12 - flicker;
      const gradient = ctx.createLinearGradient(x, base, x, base + 15);
      gradient.addColorStop(0, 'rgba(255,238,150,.95)');
      gradient.addColorStop(.55, 'rgba(255,140,40,.85)');
      gradient.addColorStop(1, 'rgba(200,40,0,0)');
      ctx.fillStyle = gradient;
      ctx.beginPath(); ctx.moveTo(x, base + 15); ctx.lineTo(x - 3.4, base + 6); ctx.lineTo(x, base); ctx.lineTo(x + 3.4, base + 6); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
  if ((player.hasteRemaining || 0) > 0) {
    const speed = Math.hypot(player.vx || 0, player.vy || 0) || 1;
    const dx = (player.vx || 0) / speed, dy = (player.vy || 0) / speed;
    ctx.save(); ctx.strokeStyle = 'rgba(167,255,208,.75)'; ctx.lineWidth = 2;
    for (let i = 0; i < 3; i += 1) {
      const offset = (i - 1) * 7;
      const startX = player.x - dy * offset, startY = player.y + dx * offset;
      ctx.beginPath(); ctx.moveTo(startX - dx * 12, startY - dy * 12); ctx.lineTo(startX - dx * 30, startY - dy * 30); ctx.stroke();
    }
    ctx.restore();
  }
  if ((player.respawnAt || 0) > now) {
    ctx.save();
    ctx.fillStyle = 'rgba(255,158,170,.9)'; ctx.font = 'bold 10px system-ui'; ctx.textAlign = 'center';
    ctx.fillText('RESPAWN ' + Math.ceil((player.respawnAt - now) / 1000) + 's', player.x, player.y + 44);
    ctx.restore();
  }
}

export function drawPlayer(ctx, player, localId, time) {
  const domain = DOMAINS[player.energyColor] || DOMAINS.wind;
  const color = player.color || domain.primary;
  drawAura(ctx, player, time, color, player.accentColor || domain.accent);
  const key = player.energyColor || 'wind';
  const speed = Math.hypot(player.vx || 0, player.vy || 0);
  const moving = speed > MOVING_THRESHOLD;
  // Match the stride to actual speed so a dash reads faster than a walk.
  const stride = Math.min(11, WALK_FRAMES_PER_SECOND * Math.max(0.6, speed / 220));
  const frame = moving ? Math.floor((time / 1000) * stride) % WALK_FRAMES : 0;
  const idleImage = optionalImage('assets/player_' + key + '.png');
  const walkImage = optionalImage('assets/player_' + key + '_walk.png');
  const x = player.x - SPRITE.anchorX, y = player.y - SPRITE.anchorY;
  const drawn = moving
    ? drawSpriteFrame(ctx, walkImage, frame, WALK_FRAMES, x, y, SPRITE.width, SPRITE.height)
    : (drawSpriteFrame(ctx, idleImage, 0, 1, x, y, SPRITE.width, SPRITE.height)
      || drawSpriteFrame(ctx, walkImage, 0, WALK_FRAMES, x, y, SPRITE.width, SPRITE.height));
  if (!drawn) drawAjaye(ctx, player.x, player.y, player, time);
  drawSuitAccent(ctx, player);
  drawStatusEffects(ctx, player, time);
  if (Date.now() < player.shieldUntil) {
    ctx.beginPath(); ctx.arc(player.x, player.y, 25, 0, Math.PI * 2); ctx.strokeStyle = '#7bd8ff'; ctx.lineWidth = 3; ctx.stroke();
  }
  const barWidth = 42, hpRatio = Math.max(0, player.hp / player.maxHp);
  ctx.fillStyle = '#311923'; ctx.fillRect(player.x - barWidth / 2, player.y - 30, barWidth, 5);
  ctx.fillStyle = player.hp > 35 ? '#4ef2a1' : '#ff596d'; ctx.fillRect(player.x - barWidth / 2, player.y - 30, barWidth * hpRatio, 5);
  ctx.fillStyle = '#fff'; ctx.font = '12px system-ui'; ctx.textAlign = 'center';
  ctx.fillText(player.id === localId ? 'You' : player.name, player.x, player.y - 37);
  if (player.inCore) { ctx.fillStyle = '#70ffe1'; ctx.font = '10px system-ui'; ctx.fillText('CHARGING ' + Math.floor(player.coreCharge) + '% · ' + player.corePoints + ' pts', player.x, player.y + 30); }
  if (player.hp <= 0) { ctx.fillStyle = '#ff9eaa'; ctx.font = 'bold 10px system-ui'; ctx.fillText('DOWN', player.x, player.y + 31); }
}

// Choose a size-appropriate shape; small catalog enemies use a tiny procedural hull.
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

// Hostile PvE drones. Baked sprite when available, procedural hull otherwise.
export function drawWarden(ctx, warden, time) {
  const lift = Math.sin(time * .004 + warden.x) * 1.8;
  const drawn = drawSpriteFrame(ctx, optionalImage('assets/warden.png'), 0, 1,
    warden.x - WARDEN_SPRITE.size / 2, warden.y - WARDEN_SPRITE.size / 2 + lift, WARDEN_SPRITE.size, WARDEN_SPRITE.size);
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

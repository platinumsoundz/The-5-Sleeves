import { CORE_DEFAULT, DOMAINS, TILE_SIZE } from './config.js';

const imageCache = new Map();
function optionalImage(path) {
  if (imageCache.has(path)) return imageCache.get(path);
  const image = new Image();
  image.loaded = false;
  image.onload = () => { image.loaded = true; };
  image.onerror = () => { image.loaded = false; };
  image.src = path;
  imageCache.set(path, image);
  return image;
}

export function drawSpriteOrProcedural(ctx, image, drawProcedural, x, y, width, height) {
  if (image && image.loaded && image.naturalWidth > 0) {
    ctx.drawImage(image, x, y, width, height);
    return true;
  }
  drawProcedural(ctx, x, y, width, height);
  return false;
}

function drawRuinedTile(ctx, tx, ty) {
  const x = tx * TILE_SIZE, y = ty * TILE_SIZE;
  const image = optionalImage('assets/ruins_tile.png');
  if (image.loaded) ctx.drawImage(image, x, y, TILE_SIZE, TILE_SIZE);
  else {
    const shade = (tx * 7 + ty * 11) % 4;
    ctx.fillStyle = ['#1a1a1a', '#1c1c1b', '#191b1a', '#20201e'][shade];
    ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
    ctx.strokeStyle = 'rgba(101,104,96,.22)';
    ctx.strokeRect(x + .5, y + .5, TILE_SIZE - 1, TILE_SIZE - 1);
    if ((tx * 3 + ty * 5) % 4 === 0) {
      ctx.strokeStyle = 'rgba(6,8,8,.8)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x + 9, y + 2); ctx.lineTo(x + 17, y + 15); ctx.lineTo(x + 14, y + 23); ctx.lineTo(x + 29, y + 37); ctx.stroke();
    }
    if ((tx + ty * 2) % 5 === 0) {
      ctx.fillStyle = 'rgba(77,103,62,.32)';
      ctx.fillRect(x + 5, y + 29, 9, 3); ctx.fillRect(x + 10, y + 26, 4, 3);
    }
  }
  const edge = tx === 0 || ty === 0 || tx === 24 || ty === 16;
  if (edge) {
    ctx.fillStyle = (tx + ty) % 2 ? '#30302d' : '#393832';
    ctx.fillRect(x + 2, y + 3, 7, 5); ctx.fillRect(x + 29, y + 26, 8, 7);
    ctx.fillStyle = 'rgba(92,126,72,.8)';
    ctx.fillRect(x + 3, y + 2, 5, 2); ctx.fillRect(x + 30, y + 25, 5, 2);
  }
}

function drawBackground(ctx, world) {
  ctx.fillStyle = '#1a1a1a'; ctx.fillRect(0, 0, world.width, world.height);
  const columns = Math.ceil(world.width / TILE_SIZE), rows = Math.ceil(world.height / TILE_SIZE);
  for (let ty = 0; ty < rows; ty += 1) for (let tx = 0; tx < columns; tx += 1) drawRuinedTile(ctx, tx, ty);
}

function drawFog(ctx, width, height) {
  const layers = [
    [0, 0, width * .5, 'rgba(87,104,79,.22)'],
    [width, 0, width * .48, 'rgba(87,104,79,.2)'],
    [0, height, height * .5, 'rgba(88,104,78,.18)'],
    [width, height, height * .5, 'rgba(88,104,78,.19)']
  ];
  for (const [x, y, radius, color] of layers) {
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, color); gradient.addColorStop(1, 'rgba(30,40,33,0)');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, width, height);
  }
}

function drawCipherCore(ctx, core, time) {
  const pulse = 1 + Math.sin(time / 430) * .07;
  ctx.save();
  const halo = ctx.createRadialGradient(core.x, core.y, 7, core.x, core.y, 145 * pulse);
  halo.addColorStop(0, 'rgba(0,255,255,.22)'); halo.addColorStop(.48, 'rgba(0,255,255,.1)'); halo.addColorStop(1, 'rgba(0,255,255,0)');
  ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(core.x, core.y, 145 * pulse, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(core.x, core.y, core.radius, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,255,255,.055)'; ctx.fill(); ctx.strokeStyle = 'rgba(0,255,255,.68)'; ctx.lineWidth = 3; ctx.stroke();
  ctx.beginPath(); ctx.arc(core.x, core.y, core.radius - 13, 0, Math.PI * 2);
  ctx.setLineDash([5, 9]); ctx.strokeStyle = 'rgba(102,255,222,.7)'; ctx.lineWidth = 2; ctx.stroke(); ctx.setLineDash([]);
  for (let i = 0; i < 12; i += 1) {
    const angle = i * Math.PI / 6 + time * .00015;
    const radius = core.radius - 24;
    const gx = core.x + Math.cos(angle) * radius, gy = core.y + Math.sin(angle) * radius;
    ctx.save(); ctx.translate(gx, gy); ctx.rotate(angle);
    ctx.fillStyle = i % 2 ? '#00ffff' : '#78ff5f'; ctx.fillRect(-2, -5, 4, 10); ctx.restore();
  }
  ctx.shadowBlur = 22; ctx.shadowColor = '#00ffff'; ctx.fillStyle = '#47fff2';
  ctx.beginPath(); ctx.arc(core.x, core.y, 17 * pulse, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0; ctx.fillStyle = '#efffff'; ctx.beginPath(); ctx.arc(core.x, core.y, 6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#d1fff9'; ctx.font = 'bold 13px system-ui'; ctx.textAlign = 'center';
  ctx.fillText('CIPHER CORE', core.x, core.y + core.radius + 19);
  ctx.restore();
}

function drawAjayeProcedural(ctx, x, y, player, time) {
  ctx.save(); ctx.translate(x, y);
  // Front-facing sprite: Ajaye's anatomical left arm is on screen-right and wears the Sleeve.
  ctx.fillStyle = '#17191b'; ctx.fillRect(-8, -3, 16, 16);
  ctx.fillStyle = '#2c2d2d'; ctx.fillRect(-9, 1, 18, 4);
  ctx.fillStyle = '#0f1114'; ctx.fillRect(-7, 12, 6, 9); ctx.fillRect(2, 12, 6, 9);
  ctx.fillStyle = '#27292a'; ctx.fillRect(-8, 19, 8, 3); ctx.fillRect(1, 19, 8, 3);
  // Normal right arm: fabric and visible warm skin, no technology or glow.
  ctx.fillStyle = '#252729'; ctx.fillRect(-13, -2, 5, 13); ctx.fillStyle = '#bc805f'; ctx.fillRect(-13, 9, 5, 3);
  // Segmented technological Cipher Sleeve only on Ajaye's anatomical left forearm.
  const domain = player.energyColor || 'cipher';
  const primary = player.color || DOMAINS[domain]?.primary || '#00ffff';
  ctx.fillStyle = '#151c21'; ctx.fillRect(8, -2, 6, 14);
  ctx.fillStyle = '#313f43'; ctx.fillRect(8, 2, 6, 2); ctx.fillRect(8, 7, 6, 2);
  ctx.fillStyle = primary; ctx.shadowBlur = 7; ctx.shadowColor = primary;
  ctx.fillRect(10, 0, 2, 11); ctx.fillRect(8, 4, 6, 1); ctx.shadowBlur = 0;
  // Scavenger hood, scarf, utility strap, and patched charcoal clothing.
  ctx.fillStyle = '#101316'; ctx.fillRect(-9, -9, 18, 8); ctx.fillRect(-7, -5, 14, 3);
  ctx.fillStyle = '#8b664d'; ctx.fillRect(-5, -17, 10, 9);
  ctx.fillStyle = '#674431'; ctx.fillRect(-7, -22, 14, 9);
  ctx.fillRect(-9, -19, 3, 6); ctx.fillRect(-6, -24, 4, 4); ctx.fillRect(-1, -25, 5, 4); ctx.fillRect(4, -22, 4, 5);
  ctx.fillStyle = '#b67c54'; ctx.fillRect(-6, -21, 3, 3); ctx.fillRect(-1, -23, 3, 3); ctx.fillRect(4, -20, 3, 3);
  ctx.fillStyle = '#071420'; ctx.fillRect(-4, -15, 2, 2); ctx.fillRect(3, -15, 2, 2);
  ctx.fillStyle = '#151719'; ctx.fillRect(-5, -9, 10, 2);
  ctx.fillStyle = '#858078'; ctx.fillRect(-5, -2, 2, 14); ctx.fillRect(3, -1, 2, 11);
  ctx.fillStyle = '#55483b'; ctx.fillRect(-9, 5, 4, 4); ctx.fillRect(5, 6, 3, 4);
  if (domain === 'dark' && Math.sin(time * .04 + player.x) > .35) {
    ctx.fillStyle = player.accentColor || '#ff29d6'; ctx.fillRect(-10, -19, 4, 2); ctx.fillRect(8, -4, 5, 2);
  }
  ctx.restore();
}

function drawPlayer(ctx, player, localId, time) {
  const domain = DOMAINS[player.energyColor] || DOMAINS.cipher;
  const color = player.color || domain.primary;
  const halo = ctx.createRadialGradient(player.x, player.y, 2, player.x, player.y, 38);
  halo.addColorStop(0, color + '55'); halo.addColorStop(1, color + '00');
  ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(player.x, player.y, 38, 0, Math.PI * 2); ctx.fill();
  for (let i = 0; i < 5; i += 1) {
    const angle = time * (player.energyColor === 'wind' ? .004 : .0018) + i * Math.PI * .4;
    const glitch = player.energyColor === 'dark' ? Math.sin(time * .045 + i * 17) * 5 : 0;
    const r = 22 + glitch;
    ctx.fillStyle = i % 2 ? (player.accentColor || domain.accent) : color;
    if (player.energyColor === 'dark' && i % 2 === 0) ctx.fillRect(player.x + Math.cos(angle) * r - 2, player.y + Math.sin(angle) * r - 2, 5, 5);
    else { ctx.beginPath(); ctx.arc(player.x + Math.cos(angle) * r, player.y + Math.sin(angle) * r, 2.4, 0, Math.PI * 2); ctx.fill(); }
  }
  const imageKey = player.energyColor === 'cipher' ? 'cipher' : player.energyColor;
  const sprite = optionalImage('assets/player_' + imageKey + '.png');
  drawSpriteOrProcedural(ctx, sprite, (context, x, y) => drawAjayeProcedural(context, x, y, player, time), player.x - 16, player.y - 17, 32, 40);
  if (Date.now() < player.shieldUntil) {
    ctx.beginPath(); ctx.arc(player.x, player.y, 25, 0, Math.PI * 2); ctx.strokeStyle = '#7bd8ff'; ctx.lineWidth = 3; ctx.stroke();
  }
  const barW = 42, hpRatio = Math.max(0, player.hp / player.maxHp);
  ctx.fillStyle = '#311923'; ctx.fillRect(player.x - barW / 2, player.y - 30, barW, 5);
  ctx.fillStyle = player.hp > 35 ? '#4ef2a1' : '#ff596d'; ctx.fillRect(player.x - barW / 2, player.y - 30, barW * hpRatio, 5);
  ctx.fillStyle = '#fff'; ctx.font = '12px system-ui'; ctx.textAlign = 'center';
  ctx.fillText(player.id === localId ? 'You' : player.name, player.x, player.y - 37);
  if (player.inCore) { ctx.fillStyle = '#70ffe1'; ctx.font = '10px system-ui'; ctx.fillText('CHARGING ' + Math.floor(player.coreCharge) + '% · ' + player.corePoints + ' pts', player.x, player.y + 30); }
  if (player.hp <= 0) { ctx.fillStyle = '#ff9eaa'; ctx.font = 'bold 10px system-ui'; ctx.fillText('DOWN', player.x, player.y + 31); }
}

function drawProjectiles(ctx, projectiles) {
  for (const projectile of Object.values(projectiles || {})) {
    ctx.save(); ctx.shadowBlur = 18; ctx.shadowColor = projectile.accentColor || projectile.color || '#00ffff';
    ctx.strokeStyle = projectile.color || '#d9ffff'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(projectile.x, projectile.y); ctx.lineTo(projectile.x - projectile.vx * .045, projectile.y - projectile.vy * .045); ctx.stroke();
    ctx.fillStyle = projectile.accentColor || projectile.color || '#d9ffff';
    ctx.beginPath(); ctx.arc(projectile.x, projectile.y, projectile.radius || 8, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
}

function drawHud(ctx, state, width) {
  const player = state.players[state.playerId] || state.localPlayer;
  if (!player) return;
  ctx.save(); ctx.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0);
  const w = Math.min(210, width - 24), x = 12, y = 56;
  ctx.fillStyle = 'rgba(8,18,31,.8)'; ctx.fillRect(x, y, w, 45);
  ctx.fillStyle = '#421e2a'; ctx.fillRect(x + 8, y + 8, w - 16, 10);
  ctx.fillStyle = '#f25d75'; ctx.fillRect(x + 8, y + 8, (w - 16) * Math.max(0, player.hp / player.maxHp), 10);
  ctx.fillStyle = '#fff'; ctx.font = '11px system-ui'; ctx.textAlign = 'left';
  ctx.fillText('HP ' + Math.ceil(player.hp) + '/' + player.maxHp, x + 8, y + 32);
  ctx.fillStyle = '#61ffe0'; ctx.textAlign = 'right'; ctx.fillText('CORE ' + Math.floor(player.coreCharge) + '% · ' + player.corePoints + ' pts', x + w - 8, y + 32);
  ctx.restore();
}

export function renderFrame(canvas, ctx, state, time) {
  const ratio = window.devicePixelRatio || 1;
  const width = window.innerWidth, height = window.innerHeight;
  if (canvas.width !== Math.floor(width * ratio) || canvas.height !== Math.floor(height * ratio)) {
    canvas.width = Math.floor(width * ratio); canvas.height = Math.floor(height * ratio);
  }
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0); ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, width, height); ctx.fillStyle = '#101715'; ctx.fillRect(0, 0, width, height);
  const world = state.world || { width: 1000, height: 700 };
  const scale = Math.min(width / world.width, height / world.height, 1);
  ctx.save(); ctx.translate((width - world.width * scale) / 2, (height - world.height * scale) / 2); ctx.scale(scale, scale);
  drawBackground(ctx, world);
  drawCipherCore(ctx, state.core || CORE_DEFAULT, time);
  drawProjectiles(ctx, state.projectiles);
  Object.values(state.players || {}).forEach((player) => drawPlayer(ctx, player, state.playerId, time));
  drawFog(ctx, world.width, world.height);
  ctx.restore(); drawHud(ctx, state, width);
}

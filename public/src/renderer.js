import { CORE_DEFAULT, PERIMETER_MARGIN, TILE_SIZE } from './config.js';
import { optionalImage } from './assetLoader.js';
import { drawPlayer } from './characterRenderer.js';

function drawRuinedTile(ctx, tx, ty, world) {
  const x = tx * TILE_SIZE, y = ty * TILE_SIZE;
  const image = optionalImage('assets/ruins_tile.png');
  if (image.loaded) ctx.drawImage(image, x, y, TILE_SIZE, TILE_SIZE);
  else {
    const shade = (tx * 7 + ty * 11) % 4;
    ctx.fillStyle = ['#1a1a1a', '#1c1c1b', '#191b1a', '#20201e'][shade];
    ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
    ctx.strokeStyle = 'rgba(101,104,96,.22)'; ctx.strokeRect(x + .5, y + .5, TILE_SIZE - 1, TILE_SIZE - 1);
    if ((tx * 3 + ty * 5) % 4 === 0) {
      ctx.strokeStyle = 'rgba(6,8,8,.8)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x + 9, y + 2); ctx.lineTo(x + 17, y + 15); ctx.lineTo(x + 14, y + 23); ctx.lineTo(x + 29, y + 37); ctx.stroke();
    }
    if ((tx + ty * 2) % 5 === 0) { ctx.fillStyle = 'rgba(77,103,62,.32)'; ctx.fillRect(x + 5, y + 29, 9, 3); ctx.fillRect(x + 10, y + 26, 4, 3); }
  }
  const columns = Math.ceil(world.width / TILE_SIZE), rows = Math.ceil(world.height / TILE_SIZE);
  if (tx === 0 || ty === 0 || tx === columns - 1 || ty === rows - 1) {
    ctx.fillStyle = (tx + ty) % 2 ? '#30302d' : '#393832';
    ctx.fillRect(x + 2, y + 3, 7, 5); ctx.fillRect(x + 29, y + 26, 8, 7);
    ctx.fillStyle = 'rgba(92,126,72,.8)'; ctx.fillRect(x + 3, y + 2, 5, 2); ctx.fillRect(x + 30, y + 25, 5, 2);
  }
}
function drawBackground(ctx, world) {
  ctx.fillStyle = '#1a1a1a'; ctx.fillRect(0, 0, world.width, world.height);
  const columns = Math.ceil(world.width / TILE_SIZE), rows = Math.ceil(world.height / TILE_SIZE);
  for (let y = 0; y < rows; y += 1) for (let x = 0; x < columns; x += 1) drawRuinedTile(ctx, x, y, world);
}

function drawPerimeterWall(ctx, world, time) {
  const m = PERIMETER_MARGIN;
  ctx.save();
  ctx.fillStyle = 'rgba(11,17,16,.62)';
  ctx.fillRect(0, 0, world.width, m); ctx.fillRect(0, world.height - m, world.width, m);
  ctx.fillRect(0, 0, m, world.height); ctx.fillRect(world.width - m, 0, m, world.height);
  ctx.setLineDash([13, 8]); ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(143,170,117,' + (0.48 + Math.sin(time * .002) * .12) + ')';
  ctx.strokeRect(m, m, world.width - m * 2, world.height - m * 2);
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(126,148,102,.7)'; ctx.font = '10px system-ui'; ctx.textAlign = 'center';
  ctx.fillText('TOWER 1 PERIMETER WALL', world.width / 2, 15);
  ctx.restore();
}

function drawFog(ctx, width, height, time) {
  const corners = [[0, 0, width * .5], [width, 0, width * .48], [0, height, height * .5], [width, height, height * .5]];
  for (const [x, y, radius] of corners) {
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, 'rgba(87,104,79,.2)'); gradient.addColorStop(1, 'rgba(30,40,33,0)');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, width, height);
  }
  const perimeter = 2 * (width + height);
  for (let i = 0; i < 44; i += 1) {
    const distance = (i * perimeter / 44 + time * .018) % perimeter;
    const drift = Math.sin(time * .002 + i * 2.3) * 10;
    const inset = 12 + (i % 4) * 5 + drift;
    let x, y;
    if (distance < width) { x = distance; y = inset; }
    else if (distance < width + height) { x = width - inset; y = distance - width; }
    else if (distance < 2 * width + height) { x = width - (distance - width - height); y = height - inset; }
    else { x = inset; y = height - (distance - 2 * width - height); }
    ctx.fillStyle = i % 3 ? 'rgba(134,154,112,.35)' : 'rgba(174,190,133,.28)';
    ctx.beginPath(); ctx.arc(x, y, 1.5 + (i % 4) * .65, 0, Math.PI * 2); ctx.fill();
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
    const angle = i * Math.PI / 6 + time * .00015, radius = core.radius - 24;
    ctx.save(); ctx.translate(core.x + Math.cos(angle) * radius, core.y + Math.sin(angle) * radius); ctx.rotate(angle);
    ctx.fillStyle = i % 2 ? '#00ffff' : '#78ff5f'; ctx.fillRect(-2, -5, 4, 10); ctx.restore();
  }
  ctx.shadowBlur = 22; ctx.shadowColor = '#00ffff'; ctx.fillStyle = '#47fff2';
  ctx.beginPath(); ctx.arc(core.x, core.y, 17 * pulse, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0; ctx.fillStyle = '#efffff'; ctx.beginPath(); ctx.arc(core.x, core.y, 6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#d1fff9'; ctx.font = 'bold 13px system-ui'; ctx.textAlign = 'center'; ctx.fillText('CIPHER CORE', core.x, core.y + core.radius + 19);
  ctx.restore();
}

function drawArchiveEchoes(ctx, echoes, time) {
  for (const echo of Object.values(echoes || {})) {
    const pulse = 1 + Math.sin(time * .006 + echo.x) * .16;
    const glow = ctx.createRadialGradient(echo.x, echo.y, 2, echo.x, echo.y, 28 * pulse);
    glow.addColorStop(0, 'rgba(126,255,235,.62)'); glow.addColorStop(1, 'rgba(72,255,220,0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(echo.x, echo.y, 28 * pulse, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.translate(echo.x, echo.y); ctx.rotate(time * .0015 + echo.y);
    ctx.fillStyle = '#b5fff2'; ctx.shadowBlur = 13; ctx.shadowColor = '#58ffe0';
    ctx.fillRect(-6 * pulse, -6 * pulse, 12 * pulse, 12 * pulse);
    ctx.shadowBlur = 0; ctx.strokeStyle = '#48edce'; ctx.lineWidth = 1; ctx.strokeRect(-9, -9, 18, 18); ctx.restore();
  }
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
  ctx.fillStyle = '#fff'; ctx.font = '11px system-ui'; ctx.textAlign = 'left'; ctx.fillText('HP ' + Math.ceil(player.hp) + '/' + player.maxHp, x + 8, y + 32);
  ctx.fillStyle = '#61ffe0'; ctx.textAlign = 'right'; ctx.fillText('CORE ' + Math.floor(player.coreCharge) + '% · ' + player.corePoints + ' pts', x + w - 8, y + 32);
  ctx.restore();
}

export function renderFrame(canvas, ctx, state, time) {
  const ratio = window.devicePixelRatio || 1, width = window.innerWidth, height = window.innerHeight;
  if (canvas.width !== Math.floor(width * ratio) || canvas.height !== Math.floor(height * ratio)) {
    canvas.width = Math.floor(width * ratio); canvas.height = Math.floor(height * ratio);
  }
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0); ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, width, height); ctx.fillStyle = '#101715'; ctx.fillRect(0, 0, width, height);
  const world = state.world || { width: 1000, height: 700 };
  const scale = Math.min(width / world.width, height / world.height, 1);
  ctx.save(); ctx.translate((width - world.width * scale) / 2, (height - world.height * scale) / 2); ctx.scale(scale, scale);
  drawBackground(ctx, world); drawPerimeterWall(ctx, world, time);
  drawArchiveEchoes(ctx, state.archiveEchoes, time);
  drawCipherCore(ctx, state.core || CORE_DEFAULT, time); drawProjectiles(ctx, state.projectiles);
  Object.values(state.players || {}).forEach((player) => drawPlayer(ctx, player, state.playerId, time));
  drawFog(ctx, world.width, world.height, time); ctx.restore(); drawHud(ctx, state, width);
}

import { CORE_DEFAULT, DOMAINS, PERIMETER_MARGIN, TILE_SIZE, WORLD_DEFAULT } from './config.js';
import { bus } from './plugin-host.js';
import { drawSpriteFrame, optionalImage } from './assetLoader.js';
import { drawPlayer, drawWarden } from './characterRenderer.js';
import { applyCamera, isVisible, updateCamera, visibleWorldBounds } from './camera.js';
import { INTERPOLATION_DELAY, sampleTrack } from './interpolation.js';

// public/assets/ruins_tiles.png holds six 40px variants: 0-3 interior floor,
// 4-5 the cracked perimeter ring.
const TILE_VARIANTS = 6;

function drawRuinedTile(ctx, tx, ty, world, isWall) {
  const x = tx * TILE_SIZE, y = ty * TILE_SIZE;
  const tileSet = optionalImage('assets/ruins_tiles.png');
  if (drawSpriteFrame(ctx, tileSet, tileVariantFrame(tx, ty, isWall), TILE_VARIANTS, x, y, TILE_SIZE, TILE_SIZE)) return;
  const image = optionalImage('assets/ruins_tile.png');
  if (image.loaded) { ctx.drawImage(image, x, y, TILE_SIZE, TILE_SIZE); return; }
  const shade = (tx * 7 + ty * 11) % 4;
  ctx.fillStyle = ['#1a1a1a', '#1c1c1b', '#191b1a', '#20201e'][shade];
  ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
  ctx.strokeStyle = 'rgba(101,104,96,.22)'; ctx.strokeRect(x + .5, y + .5, TILE_SIZE - 1, TILE_SIZE - 1);
  if ((tx * 3 + ty * 5) % 4 === 0) {
    ctx.strokeStyle = 'rgba(6,8,8,.8)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x + 9, y + 2); ctx.lineTo(x + 17, y + 15); ctx.lineTo(x + 14, y + 23); ctx.lineTo(x + 29, y + 37); ctx.stroke();
  }
  if ((tx + ty * 2) % 5 === 0) { ctx.fillStyle = 'rgba(77,103,62,.32)'; ctx.fillRect(x + 5, y + 29, 9, 3); ctx.fillRect(x + 10, y + 26, 4, 3); }
  if (isWall) {
    ctx.fillStyle = (tx + ty) % 2 ? '#30302d' : '#393832';
    ctx.fillRect(x + 2, y + 3, 7, 5); ctx.fillRect(x + 29, y + 26, 8, 7);
    ctx.fillStyle = 'rgba(92,126,72,.8)'; ctx.fillRect(x + 3, y + 2, 5, 2); ctx.fillRect(x + 30, y + 25, 5, 2);
  }
}
// The floor never changes, so it is rasterised once into an offscreen canvas and
// blitted (clipped to the visible region) instead of redrawing every tile.
const backgroundCache = new Map();

export function tileVariantFrame(tx, ty, isWall) {
  return isWall ? 4 + ((tx + ty) % 2) : (tx * 7 + ty * 11) % 4;
}

export function buildBackground(canvas, world, drawTile, drawBands) {
  const context = canvas.getContext('2d');
  context.clearRect(0, 0, world.width, world.height);
  const columns = Math.ceil(world.width / TILE_SIZE), rows = Math.ceil(world.height / TILE_SIZE);
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < columns; x += 1) {
      drawTile(context, x, y, world, x === 0 || y === 0 || x === columns - 1 || y === rows - 1);
    }
  }
  drawBands(context, world);
  return canvas;
}

function createOffscreen(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  return canvas;
}

function assetsReady() {
  const tileSet = optionalImage('assets/ruins_tiles.png');
  const singleTile = optionalImage('assets/ruins_tile.png');
  return (tileSet.loaded && tileSet.naturalWidth > 0) || (singleTile.loaded && singleTile.naturalWidth > 0);
}

function getBackground(world) {
  const key = world.width + 'x' + world.height;
  const cached = backgroundCache.get(key);
  const ready = assetsReady();
  // Re-bake once when the optional tile art finishes loading, then keep it.
  if (cached && cached.assetsReady) return cached;
  if (cached && !ready) return cached;
  const canvas = createOffscreen(world.width, world.height);
  buildBackground(canvas, world, drawRuinedTile, drawPerimeterBands);
  const entry = { canvas, assetsReady: ready };
  backgroundCache.set(key, entry);
  return entry;
}

function drawBackground(ctx, world, view) {
  const { canvas } = getBackground(world);
  const source = sourceRectForView(view, world);
  if (source.width <= 0 || source.height <= 0) return;
  ctx.drawImage(canvas, source.x, source.y, source.width, source.height, source.x, source.y, source.width, source.height);
}

// Portion of the baked floor to copy, clamped to the world so the canvas is
// never sampled outside its bounds.
export function sourceRectForView(view, world) {
  const x = Math.max(0, Math.min(world.width, view.left));
  const y = Math.max(0, Math.min(world.height, view.top));
  const right = Math.max(0, Math.min(world.width, view.right));
  const bottom = Math.max(0, Math.min(world.height, view.bottom));
  return { x, y, width: Math.max(0, right - x), height: Math.max(0, bottom - y) };
}

// Static half of the perimeter wall; the pulsing dashed line stays live.
function drawPerimeterBands(ctx, world) {
  const m = PERIMETER_MARGIN;
  ctx.save();
  ctx.fillStyle = 'rgba(11,17,16,.62)';
  ctx.fillRect(0, 0, world.width, m); ctx.fillRect(0, world.height - m, world.width, m);
  ctx.fillRect(0, 0, m, world.height); ctx.fillRect(world.width - m, 0, m, world.height);
  ctx.restore();
}

function drawPerimeterWall(ctx, world, time) {
  const m = PERIMETER_MARGIN;
  ctx.save();
  ctx.setLineDash([13, 8]); ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(143,170,117,' + (0.48 + Math.sin(time * .002) * .12) + ')';
  ctx.strokeRect(m, m, world.width - m * 2, world.height - m * 2);
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(126,148,102,.7)'; ctx.font = '10px system-ui'; ctx.textAlign = 'center';
  ctx.fillText('TOWER 1 PERIMETER WALL', world.width / 2, 15);
  ctx.restore();
}

function drawFog(ctx, world, time, view) {
  const width = world.width, height = world.height;
  const corners = [[0, 0, width * .5], [width, 0, width * .48], [0, height, height * .5], [width, height, height * .5]];
  for (const [x, y, radius] of corners) {
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, 'rgba(87,104,79,.2)'); gradient.addColorStop(1, 'rgba(30,40,33,0)');
    ctx.fillStyle = gradient; ctx.fillRect(view.left, view.top, view.right - view.left, view.bottom - view.top);
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
    if (!isVisible(view, x, y, 8)) continue;
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
    ctx.strokeStyle = projectile.color || '#d9ffff'; ctx.lineWidth = projectile.explodes ? 6 : 4;
    ctx.beginPath(); ctx.moveTo(projectile.x, projectile.y); ctx.lineTo(projectile.x - projectile.vx * .045, projectile.y - projectile.vy * .045); ctx.stroke();
    ctx.fillStyle = projectile.accentColor || projectile.color || '#d9ffff';
    ctx.beginPath(); ctx.arc(projectile.x, projectile.y, projectile.radius || 8, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
}

// Lingering ability hazards: water snare pools and earth bulwark walls.
function drawEffects(ctx, effects, time) {
  const now = Date.now();
  for (const effect of Object.values(effects || {})) {
    const remaining = Math.max(0, (effect.expiresAt - now) / Math.max(1, effect.expiresAt - (effect.createdAt || effect.expiresAt)));
    if (effect.kind === 'pool') {
      const pulse = 1 + Math.sin(time * .006) * .04;
      const gradient = ctx.createRadialGradient(effect.x, effect.y, 4, effect.x, effect.y, effect.radius * pulse);
      gradient.addColorStop(0, 'rgba(0,150,255,.34)');
      gradient.addColorStop(.65, 'rgba(0,120,255,.18)');
      gradient.addColorStop(1, 'rgba(0,110,255,0)');
      ctx.fillStyle = gradient; ctx.beginPath(); ctx.arc(effect.x, effect.y, effect.radius * pulse, 0, Math.PI * 2); ctx.fill();
      for (let i = 0; i < 3; i += 1) {
        const t = ((time * .0006 + i / 3) % 1);
        ctx.strokeStyle = 'rgba(150,230,255,' + (0.32 * (1 - t) * remaining).toFixed(3) + ')'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(effect.x, effect.y, effect.radius * t, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.setLineDash([7, 9]); ctx.lineDashOffset = -time * .02;
      ctx.strokeStyle = 'rgba(120,220,255,' + (0.3 + 0.3 * remaining).toFixed(3) + ')'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(effect.x, effect.y, effect.radius * .9, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    } else if (effect.kind === 'wall') {
      const hpRatio = Math.max(0, Math.min(1, (effect.hp || 0) / Math.max(1, effect.maxHp || 1)));
      const color = effect.color || '#cc7722';
      const glow = ctx.createRadialGradient(effect.x, effect.y, effect.radius * .2, effect.x, effect.y, effect.radius * 1.4);
      glow.addColorStop(0, 'rgba(204,119,34,.32)'); glow.addColorStop(1, 'rgba(204,119,34,0)');
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(effect.x, effect.y, effect.radius * 1.4, 0, Math.PI * 2); ctx.fill();
      ctx.save(); ctx.translate(effect.x, effect.y);
      ctx.fillStyle = 'rgba(46,32,20,.92)';
      ctx.beginPath(); ctx.arc(0, 0, effect.radius, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, effect.radius, 0, Math.PI * 2); ctx.stroke();
      // Plate seams, cracking apart as the wall takes fire.
      ctx.strokeStyle = 'rgba(240,183,104,' + (0.25 + 0.45 * hpRatio).toFixed(3) + ')'; ctx.lineWidth = 2;
      for (let i = 0; i < 6; i += 1) {
        const angle = i * Math.PI / 3;
        ctx.beginPath(); ctx.moveTo(Math.cos(angle) * effect.radius, Math.sin(angle) * effect.radius); ctx.lineTo(0, 0); ctx.stroke();
      }
      ctx.strokeStyle = hpRatio > .35 ? '#f0b768' : '#ff6a4d'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(0, 0, effect.radius + 5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * hpRatio); ctx.stroke();
      ctx.restore();
    }
  }
}

function drawBursts(ctx, bursts, time) {
  const now = Date.now();
  for (const burst of Object.values(bursts || {})) {
    const duration = Math.max(1, burst.duration || 380);
    const age = Math.max(0, Math.min(1, 1 - (burst.expiresAt - now) / duration));
    const radius = (burst.radius || 60) * (0.35 + 0.65 * age);
    const alpha = (1 - age) * 0.8;
    ctx.save();
    ctx.strokeStyle = (burst.color || '#00ffff');
    ctx.globalAlpha = alpha * 0.5; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.arc(burst.x, burst.y, radius, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = alpha; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(burst.x, burst.y, radius * 1.06, 0, Math.PI * 2); ctx.stroke();
    if (burst.kind === 'blast') {
      const flash = ctx.createRadialGradient(burst.x, burst.y, 2, burst.x, burst.y, radius);
      flash.addColorStop(0, 'rgba(255,240,210,' + (alpha * 0.6).toFixed(3) + ')');
      flash.addColorStop(1, 'rgba(255,120,60,0)');
      ctx.fillStyle = flash; ctx.beginPath(); ctx.arc(burst.x, burst.y, radius, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
}

// The HUD is anchored to DOM slots inside the top-left / top-right blocks so
// the canvas readouts never sit underneath the SPECS button or the chat again.
// Falls back to fixed coordinates when the DOM is unavailable (tests/SSR).
function slotRect(id, fallback) {
  const element = typeof document !== 'undefined' ? document.getElementById(id) : null;
  if (!element || typeof element.getBoundingClientRect !== 'function') return fallback;
  const rect = element.getBoundingClientRect();
  if (!rect || rect.width <= 0 || rect.height <= 0) return fallback;
  return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
}

function drawHud(ctx, state, width) {
  const player = state.players[state.playerId] || state.localPlayer;
  if (!player) return;
  ctx.save(); ctx.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0);
  // Top-right block: stats, core, points, ability cooldown and progression all
  // live in one column beneath the SPECS / CHAT / SFX buttons.
  const slot = slotRect('hud-slot', { x: width - 222, y: 56, width: 210, height: 115 });
  const w = Math.max(150, Math.min(240, slot.width || 210)), x = slot.x, y = slot.y;
  ctx.fillStyle = 'rgba(8,18,31,.8)'; ctx.fillRect(x, y, w, 45);
  ctx.fillStyle = '#421e2a'; ctx.fillRect(x + 8, y + 8, w - 16, 10);
  ctx.fillStyle = '#f25d75'; ctx.fillRect(x + 8, y + 8, (w - 16) * Math.max(0, player.hp / player.maxHp), 10);
  ctx.fillStyle = '#fff'; ctx.font = '11px system-ui'; ctx.textAlign = 'left'; ctx.fillText('HP ' + Math.ceil(player.hp) + '/' + player.maxHp, x + 8, y + 32);
  ctx.fillStyle = '#61ffe0'; ctx.textAlign = 'right'; ctx.fillText('CORE ' + Math.floor(player.coreCharge) + '% · ' + player.corePoints + ' pts', x + w - 8, y + 32);

  // Sleeve ability readout with its cooldown sweep.
  const cooldownMax = player.abilityCooldownMax || 1;
  const cooldown = player.abilityCooldown || 0;
  const ready = cooldown <= 0;
  ctx.fillStyle = 'rgba(8,18,31,.8)'; ctx.fillRect(x, y + 50, w, 30);
  ctx.fillStyle = ready ? '#7dffe4' : '#7e938f'; ctx.font = 'bold 10px system-ui'; ctx.textAlign = 'left';
  ctx.fillText('[Q] ' + String(player.abilityName || 'SLEEVE ABILITY').toUpperCase(), x + 8, y + 64);
  ctx.fillStyle = 'rgba(20,40,50,.9)'; ctx.fillRect(x + 8, y + 68, w - 16, 5);
  if (ready) { ctx.fillStyle = '#3ce0b5'; ctx.fillRect(x + 8, y + 68, w - 16, 5); }
  else {
    ctx.fillStyle = '#6cc9ff';
    ctx.fillRect(x + 8, y + 68, (w - 16) * Math.max(0, 1 - cooldown / cooldownMax), 5);
    ctx.fillStyle = '#cfefff'; ctx.font = '9px system-ui'; ctx.textAlign = 'right';
    ctx.fillText((cooldown / 1000).toFixed(1) + 's', x + w - 8, y + 76);
  }

  // Progression readout: level and progress toward the next one.
  const level = player.level || 1;
  const into = player.xpIntoLevel || 0;
  const needed = player.xpNeeded || 1;
  ctx.fillStyle = 'rgba(8,18,31,.8)'; ctx.fillRect(x, y + 82, w, 30);
  ctx.fillStyle = '#ffe9a0'; ctx.font = 'bold 10px system-ui'; ctx.textAlign = 'left';
  ctx.fillText('LEVEL ' + level, x + 8, y + 96);
  ctx.fillStyle = 'rgba(64,52,24,.9)'; ctx.fillRect(x + 8, y + 100, w - 16, 5);
  ctx.fillStyle = '#ffc857'; ctx.fillRect(x + 8, y + 100, (w - 16) * Math.min(1, into / needed), 5);
  ctx.fillStyle = '#ffe9c0'; ctx.font = '9px system-ui'; ctx.textAlign = 'right';
  ctx.fillText(into + '/' + needed + ' XP', x + w - 8, y + 96);
  ctx.restore();
}

// Radar lives in the top-left block, directly beneath the connection status.
function minimapRect(width) {
  const slot = slotRect('radar-slot', { x: 12, y: 52, width: 164, height: 115 });
  const world = WORLD_DEFAULT;
  const mapWidth = Math.min(164, slot.width || 164);
  return { x: slot.x, y: slot.y, width: mapWidth, height: Math.max(48, Math.min(slot.height || 115, Math.round(mapWidth * world.height / world.width))) };
}

// The world is no longer fully visible, so the minimap doubles as orientation.
function drawMinimap(ctx, state, width) {
  const world = state.world || WORLD_DEFAULT;
  const rect = minimapRect(width);
  const mapWidth = rect.width, mapHeight = Math.round(mapWidth * world.height / world.width);
  const x = rect.x, y = rect.y;
  ctx.save();
  ctx.fillStyle = 'rgba(6,17,26,.82)'; ctx.fillRect(x, y, mapWidth, mapHeight);
  ctx.strokeStyle = 'rgba(118,255,224,.4)'; ctx.lineWidth = 1; ctx.strokeRect(x + .5, y + .5, mapWidth - 1, mapHeight - 1);
  const sx = mapWidth / world.width, sy = mapHeight / world.height;
  const core = state.core || CORE_DEFAULT;
  ctx.strokeStyle = 'rgba(0,255,255,.55)';
  ctx.beginPath(); ctx.arc(x + core.x * sx, y + core.y * sy, core.radius * sx, 0, Math.PI * 2); ctx.stroke();
  for (const echo of Object.values(state.archiveEchoes || {})) {
    ctx.fillStyle = 'rgba(150,255,236,.85)'; ctx.fillRect(x + echo.x * sx - 1, y + echo.y * sy - 1, 2, 2);
  }
  for (const player of Object.values(state.players || {})) {
    ctx.fillStyle = player.hp <= 0 ? '#666' : (player.id === state.playerId ? '#ffffff' : (player.color || '#8ef'));
    ctx.beginPath(); ctx.arc(x + player.x * sx, y + player.y * sy, player.id === state.playerId ? 3 : 2.2, 0, Math.PI * 2); ctx.fill();
  }
  for (const warden of Object.values(state.ai || {})) {
    if (warden.hp <= 0) continue;
    ctx.fillStyle = '#ffab54';
    ctx.fillRect(x + warden.x * sx - 1.6, y + warden.y * sy - 1.6, 3.2, 3.2);
  }
  for (const node of Object.values((state.objectives || {}).nodes || {})) {
    ctx.strokeStyle = node.ownerColor || 'rgba(170,210,220,.7)';
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(x + node.x * sx, y + node.y * sy, 4, 0, Math.PI * 2); ctx.stroke();
    if (!node.ownerId && node.progress > 0) {
      ctx.fillStyle = factionColor(node.progressColor);
      ctx.beginPath(); ctx.arc(x + node.x * sx, y + node.y * sy, 2, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.fillStyle = 'rgba(160,200,190,.75)'; ctx.font = '9px system-ui'; ctx.textAlign = 'left';
  ctx.fillText('TOWER 1 MAP', x + 5, y + 11);
  ctx.restore();
}

// Compact kill ticker for PvE and PvP downs; entries expire on their own.
function drawKillFeed(ctx, state, width, time) {
  const feed = (state.killFeed || []).filter((entry) => time - entry.at < 6000);
  if (feed.length !== (state.killFeed || []).length) state.killFeed = feed;
  if (!feed.length) return;
  ctx.save();
  ctx.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0);
  const slot = slotRect('hud-slot', { x: width - 222, y: 56, width: 210, height: 115 });
  ctx.textAlign = 'right'; ctx.font = 'bold 11px system-ui';
  feed.forEach((entry, index) => {
    const fade = Math.min(1, Math.max(0, (6000 - (time - entry.at)) / 900));
    const y = slot.y + (slot.height || 115) + 14 + index * 16;
    ctx.globalAlpha = fade;
    ctx.fillStyle = entry.color || '#ffd9a0';
    ctx.fillText(entry.text + (entry.xp ? '  +' + entry.xp + ' XP' : ''), width - 12, y);
  });
  ctx.globalAlpha = 1;
  ctx.restore();
}

function factionColor(faction) {
  return (faction && DOMAINS[faction] && DOMAINS[faction].primary) || '#8ce0ff';
}

function factionLabel(faction) {
  return ((faction && DOMAINS[faction] && DOMAINS[faction].label) || faction || 'UNKNOWN').toUpperCase();
}

// Domination relays: a dashed capture ring, a progress arc while flipping and a
// pulsing pylon tinted by the current holder.
function drawObjectives(ctx, state, time) {
  for (const node of Object.values((state.objectives || {}).nodes || {})) {
    ctx.save();
    ctx.globalAlpha = 0.14;
    ctx.fillStyle = node.ownerColor || '#7fd7e8';
    ctx.beginPath(); ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.setLineDash([7, 9]); ctx.lineWidth = 2;
    ctx.strokeStyle = node.ownerColor || 'rgba(150,210,225,.5)';
    ctx.beginPath(); ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    if (!node.ownerId && node.progress > 0) {
      ctx.strokeStyle = factionColor(node.progressColor); ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(node.x, node.y, node.radius - 7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (node.progress / 100)); ctx.stroke();
    }
    const pulse = 0.55 + Math.sin(time * .004 + node.x) * 0.35;
    ctx.globalAlpha = pulse + 0.2;
    ctx.fillStyle = node.ownerColor || 'rgba(190,225,235,.75)';
    ctx.fillRect(node.x - 3, node.y - 14, 6, 28);
    ctx.fillRect(node.x - 14, node.y - 3, 28, 6);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center'; ctx.font = 'bold 10px system-ui';
    ctx.fillStyle = node.contested ? '#ffd0a0' : 'rgba(210,240,245,.85)';
    ctx.fillText(node.name.toUpperCase() + (node.contested ? ' · CONTESTED' : ''), node.x, node.y - node.radius - 9);
    ctx.restore();
  }
}

function drawBanner(ctx, state, width, height, time) {
  const banner = state.banner;
  if (!banner) return;
  const age = time - banner.at;
  if (age > banner.ttl) { state.banner = null; return; }
  ctx.save();
  ctx.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0);
  ctx.globalAlpha = Math.min(1, Math.max(0, Math.min(age / 220, (banner.ttl - age) / 500)));
  ctx.textAlign = 'center'; ctx.font = 'bold 26px system-ui';
  const textWidth = ctx.measureText(banner.text).width;
  ctx.fillStyle = 'rgba(4,10,14,.72)';
  ctx.fillRect(width / 2 - textWidth / 2 - 20, height * 0.16 - 26, textWidth + 40, 40);
  ctx.fillStyle = banner.color || '#8ce0ff';
  ctx.fillText(banner.text, width / 2, height * 0.16);
  ctx.globalAlpha = 1;
  ctx.restore();
}

// Faction standings for the domination match, under the top-left radar.
function drawScoreboard(ctx, state, width) {
  const payload = state.objectives || {};
  const scores = Object.entries(payload.scores || {}).filter(([, score]) => score > 0).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const world = state.world || WORLD_DEFAULT;
  const radar = minimapRect(width);
  const mapWidth = radar.width;
  const mapHeight = Math.round(mapWidth * world.height / world.width);
  const x = radar.x, y = radar.y + mapHeight + 8;
  const limit = (payload.match && payload.match.scoreLimit) || 0;
  const rows = Math.max(1, scores.length);
  const panelHeight = 22 + rows * 15;
  ctx.save();
  ctx.fillStyle = 'rgba(6,17,26,.82)'; ctx.fillRect(x, y, mapWidth, panelHeight);
  ctx.strokeStyle = 'rgba(118,255,224,.4)'; ctx.lineWidth = 1;
  ctx.strokeRect(x + .5, y + .5, mapWidth - 1, panelHeight - 1);
  ctx.textAlign = 'left'; ctx.font = 'bold 9px system-ui';
  ctx.fillStyle = 'rgba(160,200,190,.85)';
  ctx.fillText('DOMINATION' + (limit ? ' · ' + limit + ' PTS' : ''), x + 8, y + 14);
  if (!scores.length) {
    ctx.fillStyle = 'rgba(150,180,180,.6)'; ctx.font = '10px system-ui';
    ctx.fillText('no relays held', x + 8, y + 29);
  }
  scores.forEach(([faction, score], index) => {
    const rowY = y + 28 + index * 15;
    ctx.fillStyle = factionColor(faction);
    ctx.fillRect(x + 8, rowY - 7, 7, 7);
    ctx.fillStyle = '#dff3f5'; ctx.font = '10px system-ui'; ctx.textAlign = 'left';
    ctx.fillText(factionLabel(faction), x + 20, rowY);
    ctx.fillStyle = factionColor(faction); ctx.textAlign = 'right';
    ctx.fillText(String(Math.floor(score)), x + mapWidth - 8, rowY);
  });
  ctx.restore();
}

function drawVignette(ctx, width, height) {
  const gradient = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.42, width / 2, height / 2, Math.max(width, height) * 0.72);
  gradient.addColorStop(0, 'rgba(0,0,0,0)'); gradient.addColorStop(1, 'rgba(2,6,8,.55)');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, width, height);
}

// Remote entities render slightly in the past, blended between snapshots.
function renderPlayers(state, renderTime) {
  const tracks = state.tracks;
  const result = [];
  for (const player of Object.values(state.players || {})) {
    if (!tracks || player.id === state.playerId) { result.push(player); continue; }
    const sample = sampleTrack(tracks.players, player.id, renderTime);
    if (!sample) { result.push(player); continue; }
    result.push({ ...player, x: sample.x, y: sample.y, vx: sample.vx, vy: sample.vy });
  }
  return result;
}

function renderProjectiles(state, renderTime) {
  const tracks = state.tracks;
  const result = [];
  for (const projectile of Object.values(state.projectiles || {})) {
    const sample = tracks ? sampleTrack(tracks.projectiles, projectile.id, renderTime) : null;
    result.push(sample ? { ...projectile, x: sample.x, y: sample.y, vx: sample.vx, vy: sample.vy } : projectile);
  }
  return result;
}

export function renderFrame(canvas, ctx, state, time) {
  const ratio = window.devicePixelRatio || 1, width = window.innerWidth, height = window.innerHeight;
  if (canvas.width !== Math.floor(width * ratio) || canvas.height !== Math.floor(height * ratio)) {
    canvas.width = Math.floor(width * ratio); canvas.height = Math.floor(height * ratio);
  }
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0); ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, width, height); ctx.fillStyle = '#101715'; ctx.fillRect(0, 0, width, height);
  const world = state.world || WORLD_DEFAULT;
  const camera = state.camera;
  const renderTime = time - INTERPOLATION_DELAY;
  const players = renderPlayers(state, renderTime);
  const projectiles = renderProjectiles(state, renderTime);
  const localPlayer = players.find((player) => player.id === state.playerId) || state.localPlayer;
  updateCamera(camera, localPlayer, world, width, height, time);
  const view = visibleWorldBounds(camera, width, height, world);

  ctx.save();
  applyCamera(ctx, camera, width, height);
  drawBackground(ctx, world, view); drawPerimeterWall(ctx, world, time);
  // Module hook: ground-level decoration (props, landmarks, terminals) —
  // drawn under everything that moves.
  bus.emit('render:world', { ctx, state, time, view, world });
  drawArchiveEchoes(ctx, state.archiveEchoes, time);
  drawObjectives(ctx, state, time);
  drawEffects(ctx, state.effects, time);
  drawCipherCore(ctx, state.core || CORE_DEFAULT, time); drawProjectiles(ctx, projectiles);
  Object.values(state.ai || {}).forEach((warden) => { if (warden.hp > 0) drawWarden(ctx, warden, time); });
  players.forEach((player) => drawPlayer(ctx, player, state.playerId, time));
  drawBursts(ctx, state.bursts, time);
  // Module hook: above-entity effects (sparks, damage numbers, afterimages).
  bus.emit('render:fx', { ctx, state, time, view, world });
  drawFog(ctx, world, time, view); ctx.restore();

  drawVignette(ctx, width, height);
  drawMinimap(ctx, state, width);
  drawScoreboard(ctx, state, width);
  drawKillFeed(ctx, state, width, time);
  drawBanner(ctx, state, width, height, time);
  drawHud(ctx, state, width);
  // Module hook: screen-space overlay, drawn last so it sits above the HUD.
  bus.emit('render:overlay', { ctx, state, time, width, height });
}

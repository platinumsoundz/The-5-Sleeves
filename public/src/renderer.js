import { CORE_DEFAULT, DOMAINS, HUB, PERIMETER_MARGIN, TILE_SIZE, WORLD_DEFAULT } from './config.js';
import { bus } from './plugin-host.js';
import { optionalImage } from './assetLoader.js';
import { drawPlayer, drawEnemy } from './characterRenderer.js';
import { applyCamera, isVisible, updateCamera, visibleWorldBounds } from './camera.js';
import { INTERPOLATION_DELAY, sampleTrack } from './interpolation.js';
import { drawHud, slotRect } from './hud.js';
import { biomeFor, drawBiomeBands, drawBiomeTile, tileVariantFrame } from './biomes.js';

// Keep the helper exported for tests even though the painters live in biomes.js.
export { tileVariantFrame };

// The floor never changes, so it is rasterised once per biome into an
// offscreen canvas and blitted (clipped to the visible region) instead of
// redrawing every tile.
const backgroundCache = new Map();

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

function getBackground(world, biome = 'wasteland') {
  const key = biome + ':' + world.width + 'x' + world.height;
  const cached = backgroundCache.get(key);
  const ready = biome !== 'wasteland' || assetsReady();
  // Re-bake once when the optional tile art finishes loading, then keep it.
  if (cached && cached.assetsReady) return cached;
  if (cached && !ready) return cached;
  const canvas = createOffscreen(world.width, world.height);
  buildBackground(
    canvas, world,
    (ctx, tx, ty, simWorld, isWall) => drawBiomeTile(ctx, tx, ty, simWorld, isWall, biome),
    (ctx, simWorld) => drawBiomeBands(ctx, simWorld, biome)
  );
  const entry = { canvas, assetsReady: ready };
  backgroundCache.set(key, entry);
  return entry;
}

function drawBackground(ctx, world, view, biome = 'wasteland') {
  const { canvas } = getBackground(world, biome);
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

function drawPerimeterWall(ctx, world, time, state) {
  const m = PERIMETER_MARGIN;
  ctx.save();
  ctx.setLineDash([13, 8]); ctx.lineWidth = 2;
  ctx.strokeStyle = biomeFor(state?.zone?.biome).edge;
  ctx.strokeRect(m, m, world.width - m * 2, world.height - m * 2);
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(126,148,102,.7)'; ctx.font = '10px system-ui'; ctx.textAlign = 'center';
  ctx.fillText((state?.zone?.name || 'THE PERIMETER').toUpperCase(), world.width / 2, 15);
  ctx.restore();
}

function drawSafeZone(ctx, state, time) {
  const safe = state.hub || state.safeZone || (state.zone?.kind === 'haven' ? HUB : null);
  if (!safe) return;
  ctx.save();
  const isRect = Number.isFinite(safe.width) && Number.isFinite(safe.height);
  const pulse = 1 + Math.sin(time * 0.0018) * 0.03;
  if (isRect) {
    const cx = safe.x + safe.width / 2, cy = safe.y + safe.height / 2;
    const glow = ctx.createRadialGradient(cx, cy, safe.width * 0.2, cx, cy, safe.width * 0.72);
    glow.addColorStop(0, 'rgba(80,255,214,.03)');
    glow.addColorStop(0.8, 'rgba(80,255,214,.05)');
    glow.addColorStop(1, 'rgba(80,255,214,0)');
    ctx.fillStyle = glow; ctx.fillRect(safe.x, safe.y, safe.width, safe.height);
    ctx.setLineDash([12, 10]); ctx.lineDashOffset = -time * 0.012;
    ctx.strokeStyle = 'rgba(126,255,224,.48)'; ctx.lineWidth = 3;
    ctx.strokeRect(safe.x + 20, safe.y + 20, safe.width - 40, safe.height - 40);
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(160,255,232,.85)'; ctx.font = 'bold 13px system-ui'; ctx.textAlign = 'center';
    ctx.fillText('SAFE CITY · NO COMBAT · EVERY MERCHANT BUYS LOOT', cx, safe.y + 44);
  } else {
    const glow = ctx.createRadialGradient(safe.x, safe.y, safe.radius * 0.35, safe.x, safe.y, safe.radius * pulse);
    glow.addColorStop(0, 'rgba(80,255,214,.03)');
    glow.addColorStop(0.75, 'rgba(80,255,214,.06)');
    glow.addColorStop(1, 'rgba(80,255,214,0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(safe.x, safe.y, safe.radius * pulse, 0, Math.PI * 2); ctx.fill();
    ctx.setLineDash([12, 10]); ctx.lineDashOffset = -time * 0.012;
    ctx.strokeStyle = 'rgba(126,255,224,.48)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(safe.x, safe.y, safe.radius, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(160,255,232,.8)'; ctx.font = 'bold 11px system-ui'; ctx.textAlign = 'center';
    ctx.fillText('SAFE CAMP · NO COMBAT', safe.x, safe.y - safe.radius - 10);
  }
  ctx.restore();
}

function drawTowers(ctx, state, time) {
  for (const tower of state.towers || []) {
    const unlocked = !!tower.unlocked;
    const pulse = 0.6 + Math.sin(time * 0.003 + tower.x) * 0.3;
    ctx.save();
    ctx.translate(tower.x, tower.y);
    ctx.globalAlpha = unlocked ? 0.18 : 0.28;
    ctx.fillStyle = unlocked ? '#7dffd8' : '#4d6b63';
    ctx.beginPath(); ctx.arc(0, 0, tower.radius || 64, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.setLineDash(unlocked ? [] : [5, 8]);
    ctx.strokeStyle = unlocked ? 'rgba(125,255,216,.85)' : 'rgba(126,168,155,.55)';
    ctx.lineWidth = unlocked ? 2.5 : 1.5;
    ctx.beginPath(); ctx.arc(0, 0, tower.radius || 64, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = unlocked ? '#baffee' : '#78978d';
    ctx.fillRect(-5, -30, 10, 46);
    ctx.fillStyle = unlocked ? '#7dffd8' : '#4f6a62';
    ctx.fillRect(-12, -20, 24, 8);
    ctx.globalAlpha = unlocked ? 0.9 : 0.4;
    ctx.fillStyle = unlocked ? '#7dffd8' : '#8aa9a0';
    ctx.beginPath(); ctx.arc(0, -38, 5 + pulse * 2, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = unlocked ? 'rgba(186,255,238,.9)' : 'rgba(150,180,172,.7)';
    ctx.font = 'bold 10px system-ui'; ctx.textAlign = 'center';
    ctx.fillText((tower.name || 'TOWER').toUpperCase() + (unlocked ? ' · ONLINE' : ' · DORMANT'), 0, (tower.radius || 64) + 16);
    ctx.restore();
  }
}

function drawFog(ctx, world, time, view, towers = []) {
  const width = world.width, height = world.height;
  // Every regional tower that comes online thins and shrinks the fogline, so
  // restoring the network visibly pushes the wasteland back.
  const online = towers.filter((tower) => tower.unlocked).length;
  const cleared = towers.length ? Math.min(1, online / towers.length) : 0;
  const fogAlpha = 0.2 * (1 - cleared * 0.72);
  const shrink = 1 - cleared * 0.22;
  const corners = [[0, 0, width * .5 * shrink], [width, 0, width * .48 * shrink], [0, height, height * .5 * shrink], [width, height, height * .5 * shrink]];
  for (const [x, y, radius] of corners) {
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, 'rgba(87,104,79,' + fogAlpha.toFixed(3) + ')'); gradient.addColorStop(1, 'rgba(30,40,33,0)');
    ctx.fillStyle = gradient; ctx.fillRect(view.left, view.top, view.right - view.left, view.bottom - view.top);
  }
  const perimeter = 2 * (width + height);
  const motes = Math.round(44 * (1 - cleared * 0.5));
  for (let i = 0; i < motes; i += 1) {
    const distance = (i * perimeter / Math.max(1, motes) + time * .018) % perimeter;
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

// Radar lives in the top-left block, directly beneath the connection status.
// Its CSS slot is the single source of truth, so the map shrinks on phones and
// the scoreboard underneath stays aligned to it.
function minimapRect(width) {
  const slot = slotRect('radar-slot', { x: 10, y: 10, width: 156, height: 109 });
  const mapWidth = Math.round(Math.max(64, Math.min(180, slot.width || 164)));
  return { x: slot.x, y: slot.y, width: mapWidth, height: Math.round(mapWidth * WORLD_DEFAULT.height / WORLD_DEFAULT.width) };
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
  // Safe city cube or camp ring.
  const safe = state.hub || state.safeZone;
  if (safe) {
    ctx.strokeStyle = 'rgba(126,255,224,.55)';
    if (Number.isFinite(safe.width) && Number.isFinite(safe.height)) {
      ctx.strokeRect(x + safe.x * sx + 1, y + safe.y * sy + 1, Math.max(1, safe.width * sx - 2), Math.max(1, safe.height * sy - 2));
    } else {
      ctx.beginPath(); ctx.arc(x + safe.x * sx, y + safe.y * sy, safe.radius * sx, 0, Math.PI * 2); ctx.stroke();
    }
  }
  const towerMark = state.zone?.tower;
  if (towerMark) {
    ctx.fillStyle = '#7dffd8';
    ctx.fillRect(x + towerMark.x * sx - 2, y + towerMark.y * sy - 2, 4, 4);
  }
  for (const npc of state.npcs || []) {
    ctx.fillStyle = npc.color || '#ffd479';
    ctx.beginPath(); ctx.arc(x + npc.x * sx, y + npc.y * sy, 2.4, 0, Math.PI * 2); ctx.fill();
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
  ctx.fillText((state.zone?.kind || 'zone').toUpperCase() + (mapWidth < 128 ? '' : ' · TACTICAL'), x + 5, y + 11);
  ctx.restore();
}

// Compact kill ticker for PvE and PvP downs; entries expire on their own.
function drawKillFeed(ctx, state, width, time) {
  const feed = (state.killFeed || []).filter((entry) => time - entry.at < 6000);
  if (feed.length !== (state.killFeed || []).length) state.killFeed = feed;
  if (!feed.length) return;
  ctx.save();
  ctx.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0);
  const layout = notificationLayout(state, width, time);
  const top = layout.y - feed.length * 16;
  ctx.textAlign = 'left'; ctx.font = 'bold 11px system-ui';
  feed.forEach((entry, index) => {
    const fade = Math.min(1, Math.max(0, (6000 - (time - entry.at)) / 900));
    const y = top + index * 16;
    ctx.globalAlpha = fade;
    ctx.fillStyle = entry.color || '#ffd9a0';
    ctx.fillText(entry.text + (entry.xp ? '  +' + entry.xp + ' XP' : ''), layout.x + 4, y, layout.width - 8);
  });
  ctx.globalAlpha = 1;
  ctx.restore();
}

export function notificationLayout(state, width, time) {
  const radar = minimapRect(width);
  const world = state.world || WORLD_DEFAULT;
  const mapHeight = Math.round(radar.width * world.height / world.width);
  const scores = Object.values((state.objectives || {}).scores || {}).filter((score) => score > 0);
  const scoreboardHeight = scores.length ? 34 + Math.min(5, scores.length) * 15 : 49;
  const feedCount = (state.killFeed || []).filter((entry) => time - entry.at < 6000).length;
  const y = radar.y + mapHeight + 6 + scoreboardHeight + 10 + feedCount * 16;
  return { x: radar.x, y, width: Math.max(80, Math.min(300, width - radar.x - 16)) };
}

function factionColor(faction) {
  const teams = { red: '#ff6b7a', blue: '#5fb8ff', 'co-op': '#7dffd8' };
  return teams[faction] || (faction && DOMAINS[faction] && DOMAINS[faction].primary) || '#8ce0ff';
}

function factionLabel(faction) {
  const teams = { red: 'RED TEAM', blue: 'BLUE TEAM', 'co-op': 'CO-OP' };
  return teams[faction] || ((faction && DOMAINS[faction] && DOMAINS[faction].label) || faction || 'UNKNOWN').toUpperCase();
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

function drawBanner(ctx, state, width, time) {
  const banner = state.banner;
  if (!banner) return;
  const age = time - banner.at;
  if (age > banner.ttl) { state.banner = null; return; }
  ctx.save();
  ctx.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0);
  ctx.globalAlpha = Math.min(1, Math.max(0, Math.min(age / 220, (banner.ttl - age) / 500)));
  // Fit long banner text inside the viewport instead of clipping on phones.
  let size = 26;
  const layout = notificationLayout(state, width, time);
  const maxTextWidth = Math.max(64, layout.width - 20);
  ctx.textAlign = 'left'; ctx.font = 'bold ' + size + 'px system-ui';
  let textWidth = ctx.measureText(banner.text).width;
  while (textWidth > maxTextWidth && size > 12) {
    size -= 2;
    ctx.font = 'bold ' + size + 'px system-ui';
    textWidth = ctx.measureText(banner.text).width;
  }
  const x = layout.x, y = layout.y;
  ctx.fillStyle = 'rgba(4,10,14,.86)';
  ctx.fillRect(x, y, Math.min(layout.width, textWidth + 20), size + 18);
  ctx.fillStyle = banner.color || '#8ce0ff';
  ctx.fillText(banner.text, x + 10, y + size + 6, maxTextWidth);
  ctx.globalAlpha = 1;
  ctx.restore();
}

// Game-mode strip + faction standings, anchored directly under the minimap.
function drawScoreboard(ctx, state, width) {
  const payload = state.objectives || {};
  const scores = Object.entries(payload.scores || {}).filter(([, score]) => score > 0).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const world = state.world || WORLD_DEFAULT;
  const radar = minimapRect(width);
  const mapWidth = radar.width;
  const mapHeight = Math.round(mapWidth * world.height / world.width);
  const x = radar.x, y = radar.y + mapHeight + 6;
  const limit = (payload.match && payload.match.scoreLimit) || 0;
  const zone = state.zone || {};
  const arena = !!zone.arena || String(zone.mode || '').startsWith('arena');
  const me = state.localPlayer || state.players?.[state.playerId] || {};
  const doneTowers = Object.values(me.towers || {}).filter(Boolean).length;
  // On phones the radar is under 130 px wide, so the strip uses short labels
  // instead of letting long mode names spill over the game.
  const compact = mapWidth < 128;
  let modeLabel;
  if (arena) {
    const team = zone.alignment === 'pve' ? 'CO-OP' : 'PVP';
    const mode = zone.arenaMode === 'tdm' ? 'TDM' : zone.arenaMode === 'tower' ? 'TOWER' : 'DOMINATION';
    const longMode = zone.arenaMode === 'tdm' ? 'TEAM DEATHMATCH' : zone.arenaMode === 'tower' ? 'CAPTURE THE TOWER' : 'DOMINATION';
    const squad = zone.alignment === 'pvp' && me.arenaTeam ? ' · ' + me.arenaTeam.toUpperCase() : '';
    modeLabel = team + ' ' + (compact ? mode : longMode) + squad;
  } else if (zone.kind === 'tower') {
    const run = state.towerRun || {};
    modeLabel = (compact ? 'TOWER WAVE ' : 'TOWER RUN · WAVE ') + Math.max(1, run.wave || 1) + '/' + (run.waves || 3);
  } else if (zone.kind === 'haven') {
    modeLabel = compact ? 'SAFE CITY' : 'SAFE CITY · NO COMBAT';
  } else {
    modeLabel = compact
      ? 'WILD' + (zone.levelBand ? ' LV ' + zone.levelBand[0] + '–' + zone.levelBand[1] : '')
      : 'WILDERNESS' + (zone.levelBand ? ' · ENEMIES LV ' + zone.levelBand[0] + '–' + zone.levelBand[1] : '');
  }
  const rows = Math.max(0, scores.length);
  const panelHeight = rows ? 34 + rows * 15 : 49;
  // A phone radar is very narrow; the strip below it gets a readable minimum
  // width instead of forcing every label to abbreviate.
  const panelWidth = compact ? Math.max(mapWidth, 112) : mapWidth;
  ctx.save();
  ctx.fillStyle = 'rgba(6,17,26,.82)'; ctx.fillRect(x, y, panelWidth, panelHeight);
  ctx.strokeStyle = 'rgba(118,255,224,.4)'; ctx.lineWidth = 1;
  ctx.strokeRect(x + .5, y + .5, panelWidth - 1, panelHeight - 1);
  ctx.textAlign = 'left'; ctx.font = 'bold 9px system-ui';
  ctx.fillStyle = arena ? (zone.alignment === 'pve' ? '#8ce0ff' : '#ff9bad') : zone.kind === 'haven' ? '#8effc6' : '#ffd479';
  ctx.fillText(modeLabel, x + 8, y + 13);
  ctx.fillStyle = 'rgba(160,200,190,.75)'; ctx.font = '9px system-ui';
  const towerText = zone.kind === 'tower'
    ? (state.towerRun?.enemies || 0) + ' ENEMIES LEFT'
    : 'TOWERS ' + doneTowers + '/5' + (limit && arena ? ' · ' + limit + ' PTS' : '');
  ctx.fillText(towerText, x + 8, y + 26);
  if (!scores.length) {
    ctx.fillStyle = 'rgba(150,180,180,.55)'; ctx.font = '9px system-ui';
    ctx.fillText(zone.kind === 'haven'
      ? (compact ? 'merchant · tower' : 'merchants · arena master · tower gate')
      : arena ? 'no score yet' : (compact ? 'east → city' : 'travel east to the next city'), x + 8, y + 40);
  }
  scores.forEach(([faction, score], index) => {
    const rowY = y + 40 + index * 15;
    ctx.fillStyle = factionColor(faction);
    ctx.fillRect(x + 8, rowY - 7, 7, 7);
    ctx.fillStyle = '#dff3f5'; ctx.font = '10px system-ui'; ctx.textAlign = 'left';
    ctx.fillText(factionLabel(faction), x + 20, rowY);
    ctx.fillStyle = factionColor(faction); ctx.textAlign = 'right';
    ctx.fillText(String(Math.floor(score)), x + panelWidth - 8, rowY);
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
  drawBackground(ctx, world, view, state?.zone?.biome || 'wasteland'); drawPerimeterWall(ctx, world, time, state);
  drawSafeZone(ctx, state, time);
  drawTowers(ctx, state, time);
  // Module hook: ground-level decoration (props, landmarks, terminals) —
  // drawn under everything that moves.
  bus.emit('render:world', { ctx, state, time, view, world });
  drawArchiveEchoes(ctx, state.archiveEchoes, time);
  drawObjectives(ctx, state, time);
  drawEffects(ctx, state.effects, time);
  drawCipherCore(ctx, state.core || CORE_DEFAULT, time); drawProjectiles(ctx, projectiles);
  Object.values(state.ai || {}).forEach((enemy) => { if (enemy.hp > 0) drawEnemy(ctx, enemy, time); });
  players.forEach((player) => drawPlayer(ctx, player, state.playerId, time));
  drawBursts(ctx, state.bursts, time);
  // Module hook: above-entity effects (sparks, damage numbers, afterimages).
  bus.emit('render:fx', { ctx, state, time, view, world });
  drawFog(ctx, world, time, view, Array.from({ length: 5 }, (_, index) => ({ unlocked: !!(state.localPlayer?.towers?.[index + 1]) }))); ctx.restore();

  drawVignette(ctx, width, height);
  drawMinimap(ctx, state, width);
  drawScoreboard(ctx, state, width);
  drawKillFeed(ctx, state, width, time);
  drawBanner(ctx, state, width, time);
  drawHud(ctx, state, width);
  // Module hook: screen-space overlay, drawn last so it sits above the HUD.
  bus.emit('render:overlay', { ctx, state, time, width, height });
}

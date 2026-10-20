// Per-region ground art. The server tags every zone with a `biome`; the
// renderer bakes one background canvas per biome + world size, so a zone
// change swaps the whole floor in one cached blit. Wasteland keeps the baked
// ruins tiles; the five elemental havens and the grassy spawn are procedural.
import { TILE_SIZE } from './config.js';
import { optionalImage, drawSpriteFrame } from './assetLoader.js';

const TILE_VARIANTS = 6;

export const BIOMES = Object.freeze({
  wasteland: { label: 'Wasteland', edge: 'rgba(143,170,117,.55)', band: 'rgba(11,17,16,.62)' },
  grass: { label: 'Grassland', edge: 'rgba(143,196,110,.55)', band: 'rgba(10,24,13,.58)' },
  water: { label: 'Sunken Coast', edge: 'rgba(96,196,224,.55)', band: 'rgba(6,20,28,.6)' },
  fire: { label: 'Frost & Ember', edge: 'rgba(255,150,90,.6)', band: 'rgba(20,16,18,.62)' },
  earth: { label: 'Scorched Earth', edge: 'rgba(220,150,90,.55)', band: 'rgba(22,16,12,.62)' },
  wind: { label: 'Windward Apex', edge: 'rgba(120,232,204,.6)', band: 'rgba(12,24,27,.58)' },
  cipher: { label: 'Cipher Citadel', edge: 'rgba(176,120,255,.6)', band: 'rgba(15,9,24,.64)' },
  arena: { label: 'Arena', edge: 'rgba(230,150,168,.5)', band: 'rgba(10,10,15,.6)' }
});

export function biomeFor(id) {
  return BIOMES[id] || BIOMES.wasteland;
}

export function tileVariantFrame(tx, ty, isWall) {
  return isWall ? 4 + ((tx + ty) % 2) : (tx * 7 + ty * 11) % 4;
}

// Tiny deterministic hash so every tile's scatter is stable across bakes.
function hash(tx, ty, salt = 0) {
  let n = (tx * 374761393 + ty * 668265263 + salt * 2246822519) | 0;
  n = (n ^ (n >>> 13)) * 1274126177 | 0;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

function base(ctx, x, y, colors, shade) {
  ctx.fillStyle = colors[shade];
  ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
  ctx.strokeStyle = 'rgba(255,255,255,.03)';
  ctx.strokeRect(x + .5, y + .5, TILE_SIZE - 1, TILE_SIZE - 1);
}

function drawWastelandTile(ctx, tx, ty, x, y, isWall) {
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

function drawGrassTile(ctx, tx, ty, x, y, isWall) {
  const h = hash(tx, ty);
  base(ctx, x, y, ['#21351f', '#243a22', '#1e321d', '#283d24'], (tx * 7 + ty * 11) % 4);
  if (h > .55) {
    const gx = x + 7 + h * 20, gy = y + 29;
    ctx.strokeStyle = 'rgba(126,186,96,.42)'; ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(gx, gy); ctx.lineTo(gx - 2, gy - 7);
    ctx.moveTo(gx + 4, gy); ctx.lineTo(gx + 5, gy - 9);
    ctx.moveTo(gx + 8, gy); ctx.lineTo(gx + 9, gy - 5);
    ctx.stroke();
  }
  if (h > .86) { ctx.fillStyle = 'rgba(214,228,132,.55)'; ctx.fillRect(x + 26, y + 12, 2, 2); }
  if (h < .12) { ctx.fillStyle = 'rgba(96,74,46,.25)'; ctx.fillRect(x + 8, y + 17, 21, 6); }
  if (isWall) { ctx.fillStyle = 'rgba(16,33,15,.5)'; ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE); }
}

function drawWaterTile(ctx, tx, ty, x, y, isWall) {
  const h = hash(tx, ty, 3);
  base(ctx, x, y, ['#0b2733', '#0d2c3a', '#0a2430', '#10313f'], (tx * 7 + ty * 11) % 4);
  ctx.strokeStyle = 'rgba(88,198,224,' + (0.1 + h * 0.1) + ')'; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + 4, y + 12 + h * 12); ctx.lineTo(x + 15, y + 10 + h * 12);
  ctx.moveTo(x + 22, y + 27 - h * 9); ctx.lineTo(x + 35, y + 25 - h * 9);
  ctx.stroke();
  if (h > .82) { ctx.fillStyle = 'rgba(170,240,255,.4)'; ctx.fillRect(x + 28, y + 14, 3, 2); }
  if (isWall) {
    ctx.fillStyle = 'rgba(6,18,24,.55)'; ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
    ctx.fillStyle = 'rgba(160,225,235,.16)'; ctx.fillRect(x + 4, y + 4, TILE_SIZE - 8, 2);
  }
}

function drawFireTile(ctx, tx, ty, x, y, isWall) {
  const h = hash(tx, ty, 7);
  // Frosthold: pale frozen ground over a forge that never went out.
  base(ctx, x, y, ['#293236', '#2d373b', '#263034', '#313b3f'], (tx * 7 + ty * 11) % 4);
  if (h > .42) {
    ctx.strokeStyle = 'rgba(224,244,255,.24)'; ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x + 6, y + 9 + h * 10); ctx.lineTo(x + 18, y + 14 + h * 8); ctx.lineTo(x + 27, y + 12 + h * 12);
    ctx.stroke();
  }
  if (h > .52) {
    ctx.strokeStyle = 'rgba(255,120,52,.45)'; ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(x + 10 + h * 8, y + 31); ctx.lineTo(x + 15 + h * 6, y + 22); ctx.lineTo(x + 13 + h * 10, y + 16);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,180,96,.7)'; ctx.fillRect(x + 6 + h * 20, y + 27 - h * 6, 2, 2);
  }
  if (h < .18) { ctx.fillStyle = 'rgba(180,210,224,.14)'; ctx.fillRect(x + 9, y + 24, 18, 6); }
  if (isWall) {
    ctx.fillStyle = 'rgba(14,18,22,.55)'; ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
    ctx.fillStyle = 'rgba(255,150,90,.22)'; ctx.fillRect(x + 3, y + 3, TILE_SIZE - 6, 2);
  }
}

function drawEarthTile(ctx, tx, ty, x, y, isWall) {
  const h = hash(tx, ty, 11);
  // Emberhold: ochre ash, rusted gravel and refinery grit.
  base(ctx, x, y, ['#2b241c', '#302820', '#29231b', '#342c22'], (tx * 7 + ty * 11) % 4);
  if (h > .5) {
    ctx.strokeStyle = 'rgba(190,124,72,.26)'; ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x + 5, y + 10 + h * 12); ctx.lineTo(x + 17, y + 16 + h * 10); ctx.lineTo(x + 26, y + 13 + h * 12);
    ctx.stroke();
  }
  if (h < .3) { ctx.fillStyle = 'rgba(132,112,88,.3)'; ctx.fillRect(x + 11, y + 26, 16, 4); }
  if (h > .84) { ctx.fillStyle = 'rgba(255,170,90,.3)'; ctx.fillRect(x + 28, y + 9, 2, 2); }
  if (isWall) {
    ctx.fillStyle = 'rgba(20,14,10,.55)'; ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
    ctx.fillStyle = 'rgba(200,140,86,.18)'; ctx.fillRect(x + 3, y + 3, 15, 3);
  }
}

function drawWindTile(ctx, tx, ty, x, y, isWall) {
  const h = hash(tx, ty, 17);
  base(ctx, x, y, ['#23333a', '#26373e', '#203037', '#2a3c43'], (tx * 7 + ty * 11) % 4);
  ctx.strokeStyle = 'rgba(150,238,220,' + (0.12 + h * 0.12) + ')'; ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x + 2, y + 24 - h * 10); ctx.lineTo(x + 19, y + 18 - h * 10);
  ctx.moveTo(x + 20, y + 33 - h * 8); ctx.lineTo(x + 37, y + 27 - h * 8);
  ctx.stroke();
  if (h > .78) { ctx.strokeStyle = 'rgba(180,255,240,.22)'; ctx.beginPath(); ctx.arc(x + 20, y + 20, 7, 0, Math.PI * 2); ctx.stroke(); }
  if (isWall) {
    ctx.fillStyle = 'rgba(12,24,26,.55)'; ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
    ctx.fillStyle = 'rgba(150,238,220,.16)'; ctx.fillRect(x + 4, y + 3, TILE_SIZE - 8, 2);
  }
}

function drawCipherTile(ctx, tx, ty, x, y, isWall) {
  const h = hash(tx, ty, 23);
  base(ctx, x, y, ['#1a1426', '#1e172b', '#171122', '#221a30'], (tx * 7 + ty * 11) % 4);
  if (h > .42) {
    ctx.strokeStyle = h > .72 ? 'rgba(120,255,236,.34)' : 'rgba(174,120,255,.32)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 7, y + 8); ctx.lineTo(x + 7, y + 20); ctx.lineTo(x + 22, y + 20); ctx.lineTo(x + 22, y + 31);
    ctx.stroke();
    ctx.fillStyle = h > .72 ? 'rgba(120,255,236,.55)' : 'rgba(198,160,255,.55)';
    ctx.fillRect(x + 21, y + 30, 2, 2);
  }
  if (isWall) {
    ctx.fillStyle = 'rgba(12,8,20,.6)'; ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
    ctx.strokeStyle = 'rgba(174,120,255,.22)'; ctx.strokeRect(x + 2.5, y + 2.5, TILE_SIZE - 5, TILE_SIZE - 5);
  }
}

function drawArenaTile(ctx, tx, ty, x, y, isWall) {
  const h = hash(tx, ty, 29);
  base(ctx, x, y, ['#1a1c22', '#1d2027', '#181a20', '#20232a'], (tx * 7 + ty * 11) % 4);
  if (h > .7) { ctx.fillStyle = 'rgba(255,255,255,.035)'; ctx.fillRect(x + 6, y + 6, TILE_SIZE - 12, TILE_SIZE - 12); }
  if (isWall) {
    ctx.fillStyle = 'rgba(8,8,12,.6)'; ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
    ctx.fillStyle = (tx + ty) % 2 ? 'rgba(255,140,160,.2)' : 'rgba(120,200,255,.16)';
    ctx.fillRect(x + 3, y + 3, TILE_SIZE - 6, 3);
  }
}

const PAINTERS = {
  wasteland: drawWastelandTile,
  grass: drawGrassTile,
  water: drawWaterTile,
  fire: drawFireTile,
  earth: drawEarthTile,
  wind: drawWindTile,
  cipher: drawCipherTile,
  arena: drawArenaTile
};

export function drawBiomeTile(ctx, tx, ty, world, isWall, biomeId) {
  const x = tx * TILE_SIZE, y = ty * TILE_SIZE;
  (PAINTERS[biomeId] || drawWastelandTile)(ctx, tx, ty, x, y, isWall);
}

// Static perimeter bands: darken the border ring and run a biome-coloured
// inner line. The pulsing dashed wall stays live in the renderer.
export function drawBiomeBands(ctx, world, biomeId) {
  const biome = biomeFor(biomeId);
  const m = 40;
  ctx.save();
  ctx.fillStyle = biome.band;
  ctx.fillRect(0, 0, world.width, m); ctx.fillRect(0, world.height - m, world.width, m);
  ctx.fillRect(0, 0, m, world.height); ctx.fillRect(world.width - m, 0, m, world.height);
  ctx.strokeStyle = biome.edge;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(m + .5, m + .5, world.width - m * 2 - 1, world.height - m * 2 - 1);
  ctx.restore();
}

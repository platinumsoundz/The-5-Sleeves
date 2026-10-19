// Bakes the hand-tuned procedural art in public/src/characterRenderer.js and
// renderer.js into real PNG sprites under public/assets/. The game loads those
// files automatically when present and falls back to drawing live otherwise.
//
//   npm run sprites
const fs = require('fs');
const path = require('path');
const { createCanvas, fill, glowRect, sheet, single, parseColor } = require('./png');

const FRAME = { width: 36, height: 52 };
const ANCHOR = { x: 18, y: 28 }; // image pixel that maps to the player's origin
const TILE = { size: 40 };
const WALK_FRAMES = 4;

const DOMAINS = {
  cipher: { primary: '#00ffff', accent: '#78ff5f', dark: false },
  wind: { primary: '#00ff88', accent: '#a7ffd0', dark: false },
  water: { primary: '#0088ff', accent: '#71d5ff', dark: false },
  fire: { primary: '#ff4400', accent: '#ffb347', dark: false },
  earth: { primary: '#cc7722', accent: '#f0b768', dark: false },
  dark: { primary: '#9900ff', accent: '#ff29d6', dark: true }
};

// The leg poses for the four walk frames: [leftOffset, rightOffset, bodyBob].
const LEG_PHASES = [[0, 0, 0], [-2, 2, 1], [0, 0, 0], [2, -2, 1]];

function blend(over, base, alpha) {
  const a = parseColor(over), b = parseColor(base);
  return a.map((channel, index) => Math.round(channel * alpha + b[index] * (1 - alpha)));
}

// Mirrors drawAjaye() in public/src/characterRenderer.js, drawn from the frame
// origin so it can be baked into an image.
// The Rust Warden drone: a 40x40 frame centred on the entity origin.
function drawWarden(canvas) {
  const rect = (x, y, width, height, color, alpha = 1) => fill(canvas, x, y, width, height, color, alpha);
  glowRect(canvas, 8, 12, 24, 16, '#ffb266', 3, 0.35);
  rect(10, 14, 20, 12, '#3a3d3f');
  rect(13, 16, 14, 8, '#4b5052');
  rect(8, 18, 24, 4, '#2b2e30');
  rect(4, 12, 5, 16, '#585c5e');
  rect(31, 12, 5, 16, '#585c5e');
  rect(5, 10, 3, 3, '#c98b3a');
  rect(32, 10, 3, 3, '#c98b3a');
  glowRect(canvas, 17, 18, 6, 5, '#ffd9a0', 4, 0.7);
  rect(17, 18, 6, 5, '#ffe9c0');
  rect(18, 19, 4, 3, '#ff7a2a');
  rect(12, 26, 6, 3, '#3f4244');
  rect(22, 26, 6, 3, '#3f4244');
  rect(14, 29, 4, 2, '#8a8f91', 0.8);
  rect(22, 29, 4, 2, '#8a8f91', 0.8);
  rect(11, 6, 18, 3, '#6b7072');
  rect(19, 3, 3, 4, '#c98b3a');
}

function drawOperative(canvas, domain, frameIndex) {
  const { primary, accent, dark } = DOMAINS[domain];
  const { x: ax, y: ay } = ANCHOR;
  const rect = (rx, ry, width, height, color, alpha = 1) => fill(canvas, ax + rx, ay + ry, width, height, color, alpha);
  const [leftOffset, rightOffset, bob] = LEG_PHASES[frameIndex % LEG_PHASES.length];

  rect(-8, -3 + bob, 16, 16, '#17191b');
  rect(-9, 1 + bob, 18, 4, '#2c2d2d');
  rect(-7, 12 + leftOffset, 6, 9, '#0f1114');
  rect(2, 12 + rightOffset, 6, 9, '#0f1114');
  rect(-8, 19 + leftOffset, 8, 3, '#27292a');
  rect(1, 19 + rightOffset, 8, 3, '#27292a');
  rect(-13, -2 + bob, 5, 13, '#252729');
  rect(-13, 9 + bob, 5, 3, '#bc805f');

  rect(8, -2 + bob, 6, 14, '#151c21');
  rect(8, 2 + bob, 6, 2, '#313f43');
  rect(8, 7 + bob, 6, 2, '#313f43');
  glowRect(canvas, ax + 10, ay, 2, 11, primary, 3, 0.5);
  rect(10, 0 + bob, 2, 11, primary);
  rect(8, 4 + bob, 6, 1, primary);
  rect(8, 10 + bob, 6, 1, accent, 0.75);

  rect(-9, -9 + bob, 18, 8, '#101316');
  rect(-7, -5 + bob, 14, 3, '#101316');
  rect(-5, -17 + bob, 10, 9, '#8b664d');
  rect(-7, -22 + bob, 14, 9, '#674431');
  rect(-9, -19 + bob, 3, 6, '#674431');
  rect(-6, -24 + bob, 4, 4, '#674431');
  rect(-1, -25 + bob, 5, 4, '#674431');
  rect(4, -22 + bob, 4, 5, '#674431');
  rect(-6, -21 + bob, 3, 3, '#b67c54');
  rect(-1, -23 + bob, 3, 3, '#b67c54');
  rect(4, -20 + bob, 3, 3, '#b67c54');
  rect(-4, -15 + bob, 2, 2, '#1c83d4');
  rect(3, -15 + bob, 2, 2, '#1c83d4');
  rect(-5, -9 + bob, 10, 2, '#151719');
  rect(-5, -2 + bob, 2, 14, '#858078');
  rect(3, -1 + bob, 2, 11, '#858078');
  rect(-9, 5 + bob, 4, 4, '#55483b');
  rect(5, 6 + bob, 3, 4, '#55483b');

  if (dark) {
    glowRect(canvas, ax - 10, ay - 19, 4, 2, accent, 3, 0.4);
    rect(-10, -19 + bob, 4, 2, accent);
    rect(8, -4 + bob, 5, 2, accent);
  }
}

// Mirrors drawRuinedTile() in public/src/renderer.js. Variants 0-3 are interior
// floor tiles, variants 4-5 are the cracked perimeter ring.
function drawRuinTile(canvas, variant) {
  const shadeIndex = variant % 4;
  const base = ['#1a1a1a', '#1c1c1b', '#191b1a', '#20201e'][shadeIndex];
  fill(canvas, 0, 0, TILE.size, TILE.size, base);
  const border = blend('#656860', base, 0.22);
  fill(canvas, 0, 0, TILE.size, 1, border);
  fill(canvas, 0, 0, 1, TILE.size, border);
  fill(canvas, TILE.size - 1, 0, 1, TILE.size, border);
  fill(canvas, 0, TILE.size - 1, TILE.size, 1, border);

  if (variant === 0) {
    // Cracked slab.
    const crack = '#060808';
    const points = [[9, 2], [17, 15], [14, 23], [29, 37]];
    for (let i = 0; i < points.length - 1; i += 1) {
      const [x1, y1] = points[i], [x2, y2] = points[i + 1];
      const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
      for (let s = 0; s <= steps; s += 1) {
        const x = Math.round(x1 + (x2 - x1) * (s / steps));
        const y = Math.round(y1 + (y2 - y1) * (s / steps));
        fill(canvas, x, y, 2, 2, crack, 0.8);
      }
    }
  }
  if (variant === 1 || variant === 3) {
    fill(canvas, 5, 29, 9, 3, '#4d673e', 0.32);
    fill(canvas, 10, 26, 4, 3, '#4d673e', 0.32);
  }
  if (variant === 2) {
    fill(canvas, 22, 8, 12, 2, blend('#656860', base, 0.18));
    fill(canvas, 26, 26, 3, 3, '#6d6f66', 0.25);
  }
  if (variant === 4 || variant === 5) {
    const slab = (variant + 1) % 2 ? '#30302d' : '#393832';
    fill(canvas, 2, 3, 7, 5, slab);
    fill(canvas, 29, 26, 8, 7, slab);
    fill(canvas, 3, 2, 5, 2, '#5c7e48', 0.8);
    fill(canvas, 30, 25, 5, 2, '#5c7e48', 0.8);
  }
}

function main() {
  const outputDirectory = path.join(__dirname, '..', 'public', 'assets');
  fs.mkdirSync(outputDirectory, { recursive: true });
  const written = [];

  for (const domain of Object.keys(DOMAINS)) {
    const idle = createCanvas(FRAME.width, FRAME.height);
    drawOperative(idle, domain, 0);
    fs.writeFileSync(path.join(outputDirectory, `player_${domain}.png`), single(idle).encode());
    written.push(`player_${domain}.png`);

    const walkFrames = [];
    for (let frameIndex = 0; frameIndex < WALK_FRAMES; frameIndex += 1) {
      const canvas = createCanvas(FRAME.width, FRAME.height);
      drawOperative(canvas, domain, frameIndex);
      walkFrames.push(canvas);
    }
    fs.writeFileSync(path.join(outputDirectory, `player_${domain}_walk.png`), sheet(walkFrames).encode());
    written.push(`player_${domain}_walk.png`);
  }

  const warden = createCanvas(TILE.size, TILE.size);
  drawWarden(warden);
  fs.writeFileSync(path.join(outputDirectory, 'warden.png'), single(warden).encode());
  written.push('warden.png');

  const interior = createCanvas(TILE.size, TILE.size);
  drawRuinTile(interior, 0);
  fs.writeFileSync(path.join(outputDirectory, 'ruins_tile.png'), single(interior).encode());
  written.push('ruins_tile.png');

  const variants = [];
  for (let variant = 0; variant < 6; variant += 1) {
    const canvas = createCanvas(TILE.size, TILE.size);
    drawRuinTile(canvas, variant);
    variants.push(canvas);
  }
  fs.writeFileSync(path.join(outputDirectory, 'ruins_tiles.png'), sheet(variants).encode());
  written.push('ruins_tiles.png');

  console.log('Wrote ' + written.length + ' assets to public/assets/:\n  ' + written.join('\n  '));
}

main();

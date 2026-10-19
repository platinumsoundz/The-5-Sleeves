// Minimal dependency-free PNG writer (8-bit RGBA, no filtering) so the asset
// generator can run with plain Node — no native modules, no build step.
const zlib = require('zlib');

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) c = CRC_TABLE[(c ^ buffer[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuffer = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function encodePNG(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // colour type: RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

function parseColor(hex) {
  let value = hex.replace('#', '');
  if (value.length === 3) value = value.split('').map((c) => c + c).join('');
  return [parseInt(value.slice(0, 2), 16), parseInt(value.slice(2, 4), 16), parseInt(value.slice(4, 6), 16)];
}

// A tiny software rasteriser. Everything is drawn at SUPERSAMPLE scale and
// box-filtered down, which gives crisp pixel art with soft, anti-aliased edges
// and lets glow shapes fade out smoothly.
const SUPERSAMPLE = 4;

function createCanvas(width, height) {
  return { width, height, raw: new Float32Array(width * SUPERSAMPLE * height * SUPERSAMPLE * 4) };
}

function fill(canvas, x, y, width, height, color, alpha = 1) {
  if (alpha <= 0) return;
  const [r, g, b] = typeof color === 'string' ? parseColor(color) : color;
  const scale = SUPERSAMPLE;
  const x0 = Math.round(x * scale), y0 = Math.round(y * scale);
  const x1 = Math.round((x + width) * scale), y1 = Math.round((y + height) * scale);
  const bufferWidth = canvas.width * scale;
  for (let py = Math.max(0, y0); py < Math.min(canvas.height * scale, y1); py += 1) {
    for (let px = Math.max(0, x0); px < Math.min(bufferWidth, x1); px += 1) {
      const index = (py * bufferWidth + px) * 4;
      const sa = alpha * 255;
      const da = canvas.raw[index + 3];
      const outA = sa + da * (1 - alpha);
      canvas.raw[index] = (r * sa + canvas.raw[index] * da * (1 - alpha)) / (outA || 1);
      canvas.raw[index + 1] = (g * sa + canvas.raw[index + 1] * da * (1 - alpha)) / (outA || 1);
      canvas.raw[index + 2] = (b * sa + canvas.raw[index + 2] * da * (1 - alpha)) / (outA || 1);
      canvas.raw[index + 3] = outA;
    }
  }
}

// Draws `inner` four more times, each slightly larger and fainter: a cheap glow.
function glowRect(canvas, x, y, width, height, color, spread = 3, strength = 0.3) {
  for (let step = spread; step >= 1; step -= 1) {
    const fade = strength * (1 - step / (spread + 1)) / spread;
    fill(canvas, x - step, y - step, width + step * 2, height + step * 2, color, fade);
  }
}

function downsample(canvas) {
  const { width, height, raw } = canvas;
  const scale = SUPERSAMPLE;
  const out = new Uint8Array(width * height * 4);
  const samples = scale * scale;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let sr = 0, sg = 0, sb = 0, sa = 0;
      for (let sy = 0; sy < scale; sy += 1) {
        for (let sx = 0; sx < scale; sx += 1) {
          const index = (((y * scale + sy) * width * scale) + (x * scale + sx)) * 4;
          const a = raw[index + 3] / 255;
          sr += raw[index] * a; sg += raw[index + 1] * a; sb += raw[index + 2] * a; sa += a;
        }
      }
      const outIndex = (y * width + x) * 4;
      if (sa > 0) {
        out[outIndex] = Math.round(Math.min(255, sr / sa));
        out[outIndex + 1] = Math.round(Math.min(255, sg / sa));
        out[outIndex + 2] = Math.round(Math.min(255, sb / sa));
      }
      out[outIndex + 3] = Math.round((sa / samples) * 255);
    }
  }
  return out;
}

// Composes several canvases left-to-right into one horizontal sprite sheet.
function sheet(canvases) {
  const height = canvases[0].height;
  const width = canvases.reduce((total, canvas) => total + canvas.width, 0);
  const out = new Uint8Array(width * height * 4);
  let offset = 0;
  for (const canvas of canvases) {
    const pixels = downsample(canvas);
    const frameWidth = canvas.width;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < frameWidth; x += 1) {
        const from = (y * frameWidth + x) * 4;
        const to = (y * width + offset + x) * 4;
        out[to] = pixels[from]; out[to + 1] = pixels[from + 1];
        out[to + 2] = pixels[from + 2]; out[to + 3] = pixels[from + 3];
      }
    }
    offset += frameWidth;
  }
  return { width, height, encode: () => encodePNG(width, height, out) };
}

function single(canvas) {
  return { width: canvas.width, height: canvas.height, encode: () => encodePNG(canvas.width, canvas.height, downsample(canvas)) };
}

module.exports = { createCanvas, fill, glowRect, sheet, single, encodePNG, parseColor, SUPERSAMPLE };

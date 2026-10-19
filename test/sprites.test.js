import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const assets = path.join(path.dirname(path.dirname(fileURLToPath(import.meta.url))), 'public', 'assets');
const DOMAINS = ['cipher', 'wind', 'water', 'fire', 'earth', 'dark'];

// Minimal reader for the generator's output (8-bit RGBA, no interlacing).
function decode(file) {
  const buffer = fs.readFileSync(file);
  let offset = 8, width = 0, height = 0;
  const chunks = [];
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') { width = data.readUInt32BE(0); height = data.readUInt32BE(4); }
    if (type === 'IDAT') chunks.push(data);
    offset += 12 + length;
  }
  const raw = zlib.inflateSync(Buffer.concat(chunks));
  const pixel = (x, y) => {
    const index = y * (width * 4 + 1) + 1 + x * 4;
    return [raw[index], raw[index + 1], raw[index + 2], raw[index + 3]];
  };
  return { width, height, pixel };
}

test('every domain has an idle sprite and a walk sheet', () => {
  for (const domain of DOMAINS) {
    const idle = decode(path.join(assets, `player_${domain}.png`));
    assert.equal(idle.width, 36);
    assert.equal(idle.height, 52);
    const walk = decode(path.join(assets, `player_${domain}_walk.png`));
    assert.equal(walk.width, 36 * 4);
    assert.equal(walk.height, 52);
  }
});

test('idle sprites are not empty and keep the sleeve on the anatomical left arm', () => {
  const idle = decode(path.join(assets, 'player_cipher.png'));
  let opaque = 0, cyanLeft = 0, cyanRight = 0;
  for (let y = 0; y < idle.height; y += 1) {
    for (let x = 0; x < idle.width; x += 1) {
      const [r, g, b, a] = idle.pixel(x, y);
      if (a > 10) opaque += 1;
      if (a > 200 && r < 120 && g > 200 && b > 200) { if (x < 18) cyanLeft += 1; else cyanRight += 1; }
    }
  }
  // Front-facing: screen-right is the character's anatomical left.
  assert.ok(cyanRight > 10, 'sleeve channels must render on the right half');
  assert.equal(cyanLeft, 0, 'no sleeve energy on the ordinary arm');
  assert.ok(opaque > 800 && opaque < idle.width * idle.height, 'sprite has art but stays transparent around the edges');
});

test('walk frames differ from the idle pose', () => {
  const walk = decode(path.join(assets, 'player_cipher_walk.png'));
  const lowestRow = (frame) => {
    let lowest = -1;
    for (let y = 0; y < walk.height; y += 1) {
      for (let x = frame * 36; x < (frame + 1) * 36; x += 1) if (walk.pixel(x, y)[3] > 10) { lowest = y; break; }
    }
    return lowest;
  };
  assert.notEqual(lowestRow(0), lowestRow(1), 'boots move between walk frames');
  assert.notEqual(lowestRow(2), lowestRow(3), 'boots move between the second pair of frames');
});

test('each domain tints the sleeve differently', () => {
  const signatures = new Set();
  for (const domain of DOMAINS) {
    const sprite = decode(path.join(assets, `player_${domain}.png`));
    let signature = '';
    for (let y = 0; y < sprite.height; y += 1) {
      for (let x = 18; x < sprite.width; x += 1) signature += sprite.pixel(x, y).join(',') + ';';
    }
    signatures.add(signature);
  }
  assert.equal(signatures.size, DOMAINS.length, 'sleeve art must be unique per domain');
});

test('the tile sheet provides interior variants and perimeter variants', () => {
  const tiles = decode(path.join(assets, 'ruins_tiles.png'));
  assert.equal(tiles.width, 40 * 6);
  assert.equal(tiles.height, 40);
  const centres = new Set();
  for (let variant = 0; variant < 6; variant += 1) {
    const [r, g, b, a] = tiles.pixel(variant * 40 + 20, 20);
    assert.equal(a, 255, 'tiles are fully opaque');
    centres.add(`${r},${g},${b}`);
  }
  assert.ok(centres.size >= 3, 'interior variants differ in base shade');
  const wall = tiles.pixel(4 * 40 + 5, 5);
  const interior = tiles.pixel(0 * 40 + 5, 5);
  assert.notDeepEqual(wall, interior, 'perimeter tiles render rubble blocks');
});

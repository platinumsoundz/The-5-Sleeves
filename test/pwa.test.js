import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fullscreenActive, toggleFullscreen } from '../public/src/fullscreen.js';

const manifest = JSON.parse(readFileSync(new URL('../public/manifest.json', import.meta.url), 'utf8'));
const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const serviceWorker = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');

test('PWA manifest uses branded PNG icons and leaves orientation unlocked', () => {
  assert.deepEqual(manifest, {
    short_name: '5 Sleeves', name: 'The 5 Sleeves 2D', start_url: '/',
    display: 'standalone',
    background_color: '#0d1117', theme_color: '#00ffff',
    icons: [
      { src: 'icon_5sleeves_compass.png', sizes: '192x192', type: 'image/png' },
      { src: 'icon_5sleeves_title.png', sizes: '512x512', type: 'image/png' }
    ]
  });
  assert.equal(manifest.orientation, undefined, 'portrait and landscape follow the device');
  for (const [path, expectedSize] of [
    ['../public/icon_5sleeves_compass.png', 192],
    ['../public/icon_5sleeves_title.png', 512]
  ]) {
    const png = readFileSync(new URL(path, import.meta.url));
    assert.equal(png.toString('hex', 0, 8), '89504e470d0a1a0a', path + ' is a PNG');
    assert.equal(png.readUInt32BE(16), expectedSize, path + ' width');
    assert.equal(png.readUInt32BE(20), expectedSize, path + ' height');
  }
  assert.match(html, /<link rel=\"manifest\" href=\"\/manifest\.json\"/);
  assert.match(html, /name=\"apple-mobile-web-app-capable\" content=\"yes\"/);
  assert.match(html, /name=\"apple-mobile-web-app-status-bar-style\" content=\"black-translucent\"/);
  assert.match(html, /serviceWorker\.register\('\/sw\.js'\)/);
});

test('service worker uses network-first static requests and bypasses multiplayer endpoints', () => {
  assert.match(serviceWorker, /addEventListener\('fetch'/);
  assert.match(serviceWorker, /event\.respondWith/);
  assert.match(serviceWorker, /self\.skipWaiting\(\)/);
  assert.match(serviceWorker, /self\.clients\.claim\(\)/);
  assert.match(serviceWorker, /url\.pathname\.startsWith\('\/socket\.io\/'\)/);
  assert.match(serviceWorker, /url\.pathname\.startsWith\('\/api\/'\)/);
  assert.match(serviceWorker, /await fetch\(request\)/);
  assert.match(serviceWorker, /caches\.match\(request\)/);
  assert.match(serviceWorker, /cache\.addAll\(APP_SHELL\)/);
  assert.match(serviceWorker, /five-sleeves-shell-v2/);
  assert.match(serviceWorker, /icon_5sleeves_compass\.png/);
  assert.match(serviceWorker, /icon_5sleeves_title\.png/);
});

test('fullscreen toggle requests and exits the standard document fullscreen API', async () => {
  let doc;
  const root = { async requestFullscreen() { doc.fullscreenElement = root; } };
  doc = { documentElement: root, fullscreenElement: null, async exitFullscreen() { this.fullscreenElement = null; } };
  assert.equal(await toggleFullscreen(doc), true);
  assert.equal(fullscreenActive(doc), true);
  assert.equal(await toggleFullscreen(doc), true);
  assert.equal(fullscreenActive(doc), false);
});

test('fullscreen reports unsupported or rejected requests without throwing', async () => {
  assert.equal(await toggleFullscreen({ documentElement: {} }), false);
  assert.equal(await toggleFullscreen({ documentElement: { requestFullscreen: async () => { throw new Error('blocked'); } } }), false);
  assert.equal(fullscreenActive(null), false);
});

test('Settings offers an in-game fullscreen control with a platform fallback note', () => {
  const pages = readFileSync(new URL('../public/src/menu-pages.js', import.meta.url), 'utf8');
  assert.match(pages, /export function renderSettingsPage\(root/);
  assert.match(pages, /ENTER FULLSCREEN/);
  assert.match(pages, /Add this page to your Home Screen/);
});

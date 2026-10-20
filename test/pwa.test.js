import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fullscreenActive, toggleFullscreen } from '../public/src/fullscreen.js';

const manifest = JSON.parse(readFileSync(new URL('../public/manifest.json', import.meta.url), 'utf8'));
const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const serviceWorker = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');

test('PWA manifest declares standalone landscape launch and requested colors', () => {
  assert.deepEqual(manifest, {
    short_name: '5 Sleeves', name: 'The 5 Sleeves Online', start_url: '/',
    display: 'standalone', orientation: 'landscape',
    background_color: '#0d1117', theme_color: '#00ffff',
    icons: [
      { src: '/assets/app-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/assets/app-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' }
    ]
  });
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
  assert.match(pages, /section(root, 'DISPLAY')/);
  assert.match(pages, /ENTER FULLSCREEN/);
  assert.match(pages, /Add this page to your Home Screen/);
});

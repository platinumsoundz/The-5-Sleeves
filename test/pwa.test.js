import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fullscreenActive, toggleFullscreen } from '../public/src/fullscreen.js';

const manifest = JSON.parse(readFileSync(new URL('../public/manifest.json', import.meta.url), 'utf8'));
const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');

test('PWA manifest declares standalone landscape launch and requested colors', () => {
  assert.deepEqual(manifest, {
    short_name: '5 Sleeves', name: 'The 5 Sleeves Online', start_url: '/',
    display: 'standalone', orientation: 'landscape',
    background_color: '#0d1117', theme_color: '#00ffff'
  });
  assert.match(html, /<link rel=\"manifest\" href=\"\/manifest\.json\"/);
  assert.match(html, /name=\"apple-mobile-web-app-capable\" content=\"yes\"/);
  assert.match(html, /name=\"apple-mobile-web-app-status-bar-style\" content=\"black-translucent\"/);
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

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');

const functionSource = readFileSync(path.join(__dirname, '../public/functions/[[path]].js'), 'utf8');
const clientSource = readFileSync(path.join(__dirname, '../public/client.js'), 'utf8');
const inputSource = readFileSync(path.join(__dirname, '../public/src/inputManager.js'), 'utf8');
const serviceWorkerSource = readFileSync(path.join(__dirname, '../public/sw.js'), 'utf8');

test('Pages Function proxies only backend paths and requires a private HTTPS origin', () => {
  assert.match(functionSource, /\/socket\.io\//);
  assert.match(functionSource, /\/api\//);
  assert.match(functionSource, /GAME_SERVER_ORIGIN/);
  assert.match(functionSource, /upstream\.protocol !== 'https:'/);
  assert.match(functionSource, /return next\(\)/);
  assert.match(functionSource, /fetch\(proxyRequest\)/);
});

test('2D client implements the versioned Guild bridge with origin and parent checks', () => {
  assert.match(clientSource, /guild\.5-sleeves/);
  assert.match(clientSource, /the-5-sleeves-2d/);
  assert.match(clientSource, /event\.source !== window\.parent/);
  assert.match(clientSource, /event\.origin !== guildParentOrigin/);
  assert.match(clientSource, /type: 'ack'/);
  assert.match(clientSource, /type: 'ready'/);
});

test('Guild pause releases held inputs and blocks further gameplay input', () => {
  assert.match(inputSource, /function releaseAll\(\)/);
  assert.match(inputSource, /function setPaused\(value\)/);
  assert.match(inputSource, /held\.clear\(\)/);
  assert.match(inputSource, /if \(paused\) return/);
  assert.match(clientSource, /input\?\.setPaused\(guildPaused\)/);
});

test('PWA service worker excludes live backend routes from app-shell caching', () => {
  assert.match(serviceWorkerSource, /\/socket\.io\//);
  assert.match(serviceWorkerSource, /\/api\//);
});

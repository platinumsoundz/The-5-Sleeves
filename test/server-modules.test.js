import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { io } from 'socket.io-client';
import { TEST_PROFILE_FILE } from '../tools/profile-scratch.js';
import { loadModules } from '../server/module-loader.js';
import { createHookBus } from '../server/hook-bus.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PORT = 3131;
const url = `http://127.0.0.1:${PORT}`;

function stubContext() {
  const sockets = {};
  const hooks = createHookBus();
  return {
    hooks,
    sockets,
    context: {
      on: (event, handler) => hooks.on(event, handler),
      registerSocket: (name, handler) => { sockets[name] = handler; },
      route: () => {},
      distance: (a, b) => Math.hypot(a.x - b.x, a.y - b.y),
      applyXp: () => 0,
      persistPlayer: () => {},
      xpScale: () => 1
    }
  };
}

test('the module master scans server/modules and boots every module', () => {
  const { context } = stubContext();
  const loaded = loadModules(path.join(root, 'server', 'modules'), context);
  assert.ok(loaded.includes('archive-terminals'), 'archive terminals module is discovered automatically');
});

test('a broken module is skipped instead of crashing the master', (t) => {
  const dir = path.join(root, 'test', 'tmp-broken-module');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'broken.js'), 'throw new Error("boom");\n');
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const { context } = stubContext();
  const loaded = loadModules(dir, context);
  assert.deepEqual(loaded, [], 'the failing module is skipped');
});

function startServer() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['server.js'], { cwd: root, env: { ...process.env, PROFILE_FILE: TEST_PROFILE_FILE, PORT: String(PORT), MAX_WARDENS: '0' }, stdio: ['ignore', 'pipe', 'pipe'] });
    const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('server boot timeout')); }, 15000);
    child.stdout.on('data', (chunk) => { if (String(chunk).includes('is running')) { clearTimeout(timer); resolve(child); } });
    child.stderr.on('data', (chunk) => process.stderr.write(chunk));
    child.on('exit', (code) => { clearTimeout(timer); reject(new Error('server exited early: ' + code)); });
  });
}

function once(socket, event, predicate = () => true, timeout = 6000, label = event) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { socket.off(event, handler); reject(new Error('timed out waiting for ' + label)); }, timeout);
    function handler(payload) {
      if (!predicate(payload)) return;
      clearTimeout(timer); socket.off(event, handler); resolve(payload);
    }
    socket.on(event, handler);
  });
}

async function connect(name) {
  const socket = io(url, { transports: ['websocket'], forceNew: true });
  await once(socket, 'server:welcome');
  socket.emit('player:join', { name, zone: 'haven-perimeter' });
  const accepted = await once(socket, 'join:accepted');
  return { socket, id: accepted.playerId };
}

// End-to-end: the migrated module still serves terminals after the refactor.
test('archive terminals are served by the plug-and-play module', async (t) => {
  const server = await startServer();
  const sockets = [];
  t.after(() => { sockets.forEach((socket) => socket.close()); server.kill('SIGKILL'); });

  // The master publishes the client module manifest for the browser runner.
  const manifest = await fetch(`http://127.0.0.1:${PORT}/api/client-modules`).then((response) => response.json());
  for (const name of ['terminals', 'combat-juice', 'world-decor']) {
    assert.ok(manifest.modules.includes(name), `${name} listed in the client manifest`);
  }

  const suffix = Date.now().toString(36);
  const reader = await connect('Reader' + suffix);
  sockets.push(reader.socket);

  const list = await once(reader.socket, 'archive:terminals');
  assert.equal(list.terminals.length, 3, 'the module publishes its three terminals');

  // Stand on the transit terminal and read it.
  const terminal = list.terminals.find((spot) => spot.id === 'terminal-transit');
  reader.socket.emit('player:move', { x: terminal.x, y: terminal.y });
  await once(reader.socket, 'players', (players) => players[reader.id] && Math.hypot(players[reader.id].x - terminal.x, players[reader.id].y - terminal.y) < 20, 6000, 'walk to terminal');
  reader.socket.emit('player:interact');
  const first = await once(reader.socket, 'archive:terminal', (payload) => payload.found, 6000, 'first read');
  assert.equal(first.firstRead, true);
  assert.ok(first.log.length > 20, 'the lore text comes through');
  assert.equal(first.xp > 0, true, 'the first read pays XP');

  // Reading again pays nothing but still shows the log.
  await new Promise((resolve) => setTimeout(resolve, 700));
  reader.socket.emit('player:interact');
  const again = await once(reader.socket, 'archive:terminal', (payload) => payload.found, 6000, 're-read');
  assert.equal(again.firstRead, false);
  assert.equal(again.xp, 0);
  assert.ok(again.log.length > 20, 'the log stays re-readable');

  // Reading from across the map finds nothing.
  reader.socket.emit('player:move', { x: 900, y: 400 });
  await once(reader.socket, 'players', (players) => players[reader.id] && Math.hypot(players[reader.id].x - 900, players[reader.id].y - 400) < 20, 6000, 'walk away');
  await new Promise((resolve) => setTimeout(resolve, 700));
  reader.socket.emit('player:interact');
  const miss = await once(reader.socket, 'archive:terminal', (payload) => payload.found === false, 6000, 'not near a terminal');
  assert.equal(miss.found, false);
});

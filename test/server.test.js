import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TEST_PROFILE_FILE } from '../tools/profile-scratch.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PORT = 3123;

function startServer() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['server.js'], {
      cwd: root,
      env: { ...process.env, PROFILE_FILE: TEST_PROFILE_FILE, PORT: String(PORT) },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('server boot timeout')); }, 15000);
    child.stdout.on('data', (chunk) => {
      if (String(chunk).includes('is running')) { clearTimeout(timer); resolve(child); }
    });
    child.stderr.on('data', (chunk) => process.stderr.write(chunk));
    child.on('exit', (code) => { clearTimeout(timer); reject(new Error('server exited early with code ' + code)); });
  });
}

test('server serves the health endpoint and the client shell', async (t) => {
  const child = await startServer();
  t.after(() => child.kill('SIGKILL'));

  const health = await fetch(`http://127.0.0.1:${PORT}/health`);
  assert.equal(health.status, 200);
  const payload = await health.json();
  assert.equal(payload.status, 'ok');
  assert.equal(typeof payload.players, 'number');

  const page = await fetch(`http://127.0.0.1:${PORT}/`);
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.match(html, /THE 5 SLEEVES/);
  assert.match(html, /gameCanvas/);

  // Exercise the Engine.IO polling handshake used by Socket.IO clients.
  // This verifies the multiplayer transport is mounted, not just the HTML shell.
  const socketHandshake = await fetch(`http://127.0.0.1:${PORT}/socket.io/?EIO=4&transport=polling&t=integration-smoke`);
  assert.equal(socketHandshake.status, 200);
  const handshakePayload = await socketHandshake.text();
  assert.match(handshakePayload, /^0\{/);
  const handshake = JSON.parse(handshakePayload.slice(1));
  assert.equal(typeof handshake.sid, 'string');
  assert.ok(Array.isArray(handshake.upgrades));
  assert.ok(handshake.pingInterval > 0);

  const client = await fetch(`http://127.0.0.1:${PORT}/client.js`);
  assert.equal(client.status, 200);
  assert.match(await client.text(), /createCamera/);
});

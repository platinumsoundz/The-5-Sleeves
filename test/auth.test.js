import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const auth = require('../server/modules/auth.js');
const secureTransport = require('../server/secure-transport.js');

function buildAuth(filename, legacyName = '') {
  process.env.USERS_FILE = filename;
  const handlers = {}, guards = [];
  auth.setup({
    io: { on() {} },
    registerSocket: (name, handler) => { handlers[name] = handler; },
    registerJoinGuard: (handler) => guards.push(handler),
    legacyProfileExists: (name) => name.toLowerCase() === legacyName.toLowerCase(),
    on() {}
  });
  return { handlers, guard: guards[0] };
}
function makeSocket(id, headers = {}) {
  return {
    id, handshake: { address: 'test', headers }, request: { secure: true }, events: [],
    emit(name, payload) { this.events.push([name, payload]); }
  };
}

test('Render forwarded HTTPS and secure sockets pass while plaintext and untrusted proxy headers fail', (t) => {
  const oldNodeEnv = process.env.NODE_ENV, oldProxy = process.env.TRUSTED_PROXY_TLS;
  process.env.NODE_ENV = 'production'; delete process.env.TRUSTED_PROXY_TLS;
  t.after(() => {
    if (oldNodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = oldNodeEnv;
    if (oldProxy === undefined) delete process.env.TRUSTED_PROXY_TLS; else process.env.TRUSTED_PROXY_TLS = oldProxy;
  });
  assert.equal(secureTransport({ request: { secure: true } }), true);
  assert.equal(secureTransport({ request: { connection: { encrypted: true } } }), true);
  assert.equal(secureTransport({ handshake: { headers: { host: 'the-5-sleeves.onrender.com', 'x-forwarded-proto': 'https' } } }), true);
  assert.equal(secureTransport({ handshake: { headers: { host: 'the-5-sleeves.onrender.com', 'x-forwarded-proto': 'http' } } }), false);
  assert.equal(secureTransport({ handshake: { headers: { host: 'untrusted.example', 'x-forwarded-proto': 'https' } } }), false);
  process.env.TRUSTED_PROXY_TLS = 'true';
  assert.equal(secureTransport({ handshake: { headers: { host: 'trusted.example', 'x-forwarded-proto': 'https' } } }), true);
});

test('accounts hash passwords, isolate profiles, and reserve their usernames', async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sleeves-auth-'));
  const filename = path.join(directory, 'users.json');
  const oldFile = process.env.USERS_FILE;
  t.after(() => {
    if (oldFile === undefined) delete process.env.USERS_FILE; else process.env.USERS_FILE = oldFile;
    fs.rmSync(directory, { recursive: true, force: true });
  });

  const first = buildAuth(filename, 'LegacyGuest');
  const socket = makeSocket('socket-a');
  await first.handlers['auth:register'](null, { username: 'OperativeA', password: 'long-enough-test-password' }, socket);
  assert.ok(socket.events.some(([event]) => event === 'auth:accepted'));
  assert.equal(first.guard(socket, { mode: 'account' }, 'OperativeA').profileKey.startsWith('account:'), true);
  assert.equal(first.guard(makeSocket('guest'), { mode: 'guest' }, 'OperativeA').ok, false);
  await first.handlers['auth:register'](null, { username: 'LegacyGuest', password: 'long-enough-test-password' }, socket);
  assert.ok(socket.events.some(([event]) => event === 'auth:error'));

  const second = buildAuth(filename);
  const loginSocket = makeSocket('socket-b');
  await second.handlers['auth:login'](null, { username: 'operativea', password: 'wrong-password' }, loginSocket);
  assert.ok(loginSocket.events.some(([event]) => event === 'auth:error'));
  await second.handlers['auth:login'](null, { username: 'operativea', password: 'long-enough-test-password' }, loginSocket);
  assert.ok(loginSocket.events.some(([event]) => event === 'auth:accepted'));
  assert.equal(second.guard(loginSocket, { mode: 'account' }, 'OperativeA').profileKey, first.guard(socket, { mode: 'account' }, 'OperativeA').profileKey);
});

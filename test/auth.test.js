import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const auth = require('../server/modules/auth.js');

function buildAuth(filename, legacyName = '') {
  process.env.USERS_FILE = filename;
  const handlers = {}, guards = [];
  auth.setup({
    registerSocket: (name, handler) => { handlers[name] = handler; },
    registerJoinGuard: (handler) => guards.push(handler),
    legacyProfileExists: (name) => name.toLowerCase() === legacyName.toLowerCase(),
    on() {}
  });
  return { handlers, guard: guards[0] };
}
function makeSocket(id) {
  return { id, handshake: { address: 'test' }, events: [], emit(name, payload) { this.events.push([name, payload]); } };
}

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

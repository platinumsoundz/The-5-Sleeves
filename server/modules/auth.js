'use strict';

const crypto = require('crypto');
const path = require('path');
const { loadAccounts, saveAccounts, hashPassword, verifyPassword } = require('../account-store.js');

const USERNAME_RE = /^[\p{L}\p{N}_-]{2,18}$/u;
const PASSWORD_MIN = 12;
const PASSWORD_MAX = 128;
const ATTEMPTS_PER_MINUTE = 6;

module.exports = {
  name: 'auth',
  summary: 'Optional username/password accounts, separate from legacy guest profiles.',
  priority: 5,
  setup(ctx) {
    const filename = process.env.USERS_FILE || path.join(__dirname, '..', '..', 'users.json');
    const accounts = loadAccounts(filename);
    const sessions = new Map();
    const pendingNames = new Set();
    const rate = new Map();
    const dummyHash = hashPassword('not-a-real-account-password');

    function secureTransport(socket) {
      if (process.env.NODE_ENV === 'development') return true;
      if (socket.request?.connection?.encrypted) return true;
      return process.env.TRUSTED_PROXY_TLS === 'true'
        && socket.handshake?.headers?.['x-forwarded-proto']?.split(',')[0].trim() === 'https';
    }
    function allowAttempt(socket) {
      const key = socket.handshake?.address || socket.id;
      const now = Date.now();
      const entry = rate.get(key);
      if (!entry || now - entry.startedAt > 60000) { rate.set(key, { startedAt: now, count: 1 }); return true; }
      entry.count += 1;
      return entry.count <= ATTEMPTS_PER_MINUTE;
    }
    function validCredentials(username, password) {
      return typeof username === 'string' && USERNAME_RE.test(username)
        && typeof password === 'string' && password.length >= PASSWORD_MIN && password.length <= PASSWORD_MAX;
    }
    function accept(socket, account) {
      sessions.set(socket.id, account.id);
      socket.emit('auth:accepted', { username: account.username });
    }

    ctx.registerJoinGuard((socket, payload, name) => {
      const accountId = sessions.get(socket.id);
      if (accountId) {
        const account = Object.values(accounts).find((entry) => entry.id === accountId);
        if (!account || payload?.mode !== 'account' || name.toLowerCase() !== account.username.toLowerCase()) {
          return { ok: false, message: 'Join using the authenticated account name.' };
        }
        return { ok: true, profileKey: 'account:' + account.id };
      }
      if (payload?.mode === 'account') return { ok: false, message: 'Log in or register before joining that account.' };
      if (accounts[name.toLowerCase()]) return { ok: false, message: 'That name belongs to an account. Log in to continue.' };
      return { ok: true, profileKey: name.toLowerCase() };
    });

    ctx.registerSocket('auth:register', async (player, payload, socket) => {
      if (!secureTransport(socket)) { socket.emit('auth:error', 'Accounts require HTTPS in production.'); return; }
      if (player) { socket.emit('auth:error', 'Log out before registering a different account.'); return; }
      const username = typeof payload?.username === 'string' ? payload.username.trim() : '';
      const key = username.toLowerCase();
      const password = payload?.password;
      if (!allowAttempt(socket)) { socket.emit('auth:error', 'Too many attempts. Wait a minute and try again.'); return; }
      if (!validCredentials(username, password)) { socket.emit('auth:error', 'Use a 2–18 character username and a 12–128 character password.'); return; }
      if (accounts[key] || pendingNames.has(key) || ctx.legacyProfileExists(username)) {
        socket.emit('auth:error', 'That username is unavailable. Legacy guest profiles are not claimed automatically.');
        return;
      }
      pendingNames.add(key);
      try {
        const credentials = await hashPassword(password);
        const account = { id: crypto.randomUUID(), username, ...credentials, createdAt: new Date().toISOString() };
        accounts[key] = account;
        saveAccounts(filename, accounts);
        accept(socket, account);
      } catch (_) {
        delete accounts[key];
        socket.emit('auth:error', 'Account creation failed. Please try again.');
      } finally { pendingNames.delete(key); }
    });

    ctx.registerSocket('auth:login', async (player, payload, socket) => {
      if (!secureTransport(socket)) { socket.emit('auth:error', 'Accounts require HTTPS in production.'); return; }
      if (player) { socket.emit('auth:error', 'Log out before switching accounts.'); return; }
      const username = typeof payload?.username === 'string' ? payload.username.trim() : '';
      const password = typeof payload?.password === 'string' ? payload.password : '';
      if (!allowAttempt(socket)) { socket.emit('auth:error', 'Too many attempts. Wait a minute and try again.'); return; }
      const account = accounts[username.toLowerCase()];
      try {
        const dummy = await dummyHash;
        const valid = await verifyPassword(password, account || dummy);
        if (!account || !valid) { socket.emit('auth:error', 'Username or password is incorrect.'); return; }
        accept(socket, account);
      } catch (_) { socket.emit('auth:error', 'Login failed. Please try again.'); }
    });

    ctx.on('left', (player) => sessions.delete(player.id));
    ctx.io.on('connection', (socket) => socket.once('disconnect', () => sessions.delete(socket.id)));
  }
};

'use strict';

const crypto = require('crypto');
const fs = require('fs');
const { promisify } = require('util');
const scrypt = promisify(crypto.scrypt);

const KEY_BYTES = 64;
const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

function loadAccounts(filename) {
  try {
    const saved = JSON.parse(fs.readFileSync(filename, 'utf8'));
    return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
  } catch (error) {
    if (error.code !== 'ENOENT') console.error('Could not load accounts:', error.message);
    return {};
  }
}

function saveAccounts(filename, accounts) {
  const temporary = filename + '.tmp';
  fs.writeFileSync(temporary, JSON.stringify(accounts, null, 2), { mode: 0o600 });
  fs.renameSync(temporary, filename);
}

async function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = await scrypt(password, salt, KEY_BYTES, SCRYPT_OPTIONS);
  return { salt, hash: hash.toString('hex') };
}

async function verifyPassword(password, account) {
  const actual = await scrypt(password, account.salt, KEY_BYTES, SCRYPT_OPTIONS);
  const expected = Buffer.from(account.hash, 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

module.exports = { loadAccounts, saveAccounts, hashPassword, verifyPassword };

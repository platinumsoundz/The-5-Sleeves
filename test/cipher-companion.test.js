import test from 'node:test';
import assert from 'node:assert/strict';
import { createHookBus } from '../server/hook-bus.js';
import companionMemory from '../server/modules/cipher-companion-memory.js';
import { shouldShowCipherIntro } from '../public/src/modules/cipher-companion.js';

test('Cipher introduction is first-clear only and persists between joins', () => {
  const hooks = createHookBus();
  companionMemory.setup({ on: (event, handler) => hooks.on(event, handler) });
  const firstOperative = {};
  hooks.emit('joining', firstOperative, {});
  assert.equal(firstOperative.cipherIntroSeen, false);
  assert.equal(companionMemory.markIntroSeen(firstOperative), true);
  assert.equal(companionMemory.markIntroSeen(firstOperative), false);

  const record = {};
  hooks.emit('persist', firstOperative, record);
  assert.equal(record.cipherIntroSeen, true);

  const returningOperative = {};
  hooks.emit('joining', returningOperative, record);
  assert.equal(returningOperative.cipherIntroSeen, true);
  assert.equal(companionMemory.markIntroSeen(returningOperative), false);
});

test('the client companion only opens for the server-marked first tower clear', () => {
  assert.equal(shouldShowCipherIntro(null), false);
  assert.equal(shouldShowCipherIntro({}), false);
  assert.equal(shouldShowCipherIntro({ cipherIntro: false }), false);
  assert.equal(shouldShowCipherIntro({ cipherIntro: true }), true);
});

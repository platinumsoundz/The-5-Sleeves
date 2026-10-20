import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const definition = require('../server/modules/dev-console.js');

function buildConsole() {
  const handlers = {}, persisted = [];
  const player = { id: 'dev-player', credits: 1, skillPoints: 0, corePoints: 0, inventory: [], skills: {}, terminalsRead: [] };
  const zone = { kind: 'haven', terminals: [{ id: 'sample-terminal' }], broadcast() {} };
  const ctx = {
    route() {},
    registerSocket: (name, handler) => { handlers[name] = handler; },
    on() {}, zones: () => ({ haven: zone }),
    playerZone: () => zone,
    persistPlayer: (target) => persisted.push(target)
  };
  definition.setup(ctx);
  const events = [];
  const socket = { id: 'test-socket', emit: (...event) => events.push(event) };
  return { handlers, player, socket, events, persisted };
}

test('test grants require a development token and mutate server-owned state', () => {
  const previous = { node: process.env.NODE_ENV, enabled: process.env.DEV_CONSOLE_ENABLED, token: process.env.DEV_CONSOLE_TOKEN };
  process.env.NODE_ENV = 'development';
  process.env.DEV_CONSOLE_ENABLED = 'true';
  process.env.DEV_CONSOLE_TOKEN = 't'.repeat(40);
  try {
    const { handlers, player, socket, events, persisted } = buildConsole();
    handlers['dev:grant'](player, { grant: 'all' }, socket);
    assert.equal(player.credits, 1, 'grants fail before authorization');
    handlers['dev:authorize'](null, { token: 'wrong' }, socket);
    handlers['dev:authorize'](null, { token: process.env.DEV_CONSOLE_TOKEN }, socket);
    handlers['dev:grant'](player, { grant: 'all' }, socket);
    assert.equal(player.credits, 999999);
    assert.equal(player.skillPoints, 9999);
    assert.ok(player.inventory.length > 0);
    assert.ok(player.skills['conduit-root']);
    assert.ok(player.terminalsRead.includes('sample-terminal'));
    assert.equal(persisted.at(-1), player);
    assert.ok(events.some(([name]) => name === 'dev:granted'));
  } finally {
    for (const [key, value] of Object.entries({ NODE_ENV: previous.node, DEV_CONSOLE_ENABLED: previous.enabled, DEV_CONSOLE_TOKEN: previous.token })) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});

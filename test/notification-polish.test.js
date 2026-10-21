import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import creditFeedback from '../public/src/modules/credit-feedback.js';

test('authoritative credit increases appear in the existing XP-style HUD feed', () => {
  const handlers = {};
  const state = { localPlayer: { credits: 25 }, killFeed: [] };
  creditFeedback.setup({ on: (event, handler) => { handlers[event] = handler; } });
  const frame = (time) => handlers.frame({ state, time, dt: 0.016 });

  frame(100); // establish the join balance without a false reward popup
  state.localPlayer.credits = 33;
  frame(200);
  assert.deepEqual(state.killFeed, [{ text: '+8 CREDITS', at: 200, color: '#f3d879' }]);

  state.localPlayer.credits = 29;
  frame(300); // spending credits is not an earned-credit notice
  state.localPlayer.credits = 31;
  frame(400);
  assert.equal(state.killFeed[1].text, '+2 CREDITS');
});

test('ordinary notices move right while archive/story toasts keep their blue left slot', async () => {
  const [html, ui, client] = await Promise.all([
    readFile(new URL('../public/index.html', import.meta.url), 'utf8'),
    readFile(new URL('../public/src/uiManager.js', import.meta.url), 'utf8'),
    readFile(new URL('../public/client.js', import.meta.url), 'utf8')
  ]);
  const systemRule = html.match(/#system-toast\s*\{([^}]+)\}/)?.[1] || '';
  const archiveRule = html.match(/#archive-toast\s*\{([^}]+)\}/)?.[1] || '';
  assert.match(systemRule, /right:var\(--safe-r\)/);
  assert.match(systemRule, /left:auto/);
  assert.match(archiveRule, /left:var\(--safe-l\)/);
  assert.match(archiveRule, /#dcedff/);
  assert.match(ui, /function showArchiveToast\(/);
  assert.match(ui, /showArchiveToast,/);
  assert.match(ui, /notice\(message\) \{ showToast\(message, 3200\); \}/);
  assert.doesNotMatch(client, /at:\s*Date\.now\(\)/, 'HUD feed timestamps use the animation-frame clock');
});

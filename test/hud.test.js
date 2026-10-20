import test from 'node:test';
import assert from 'node:assert/strict';
import { drawHud, zoneLabel } from '../public/src/hud.js';

// Minimal canvas recorder: the HUD only fills rectangles and writes text, so
// these four methods are enough to prove the layout stays inside its slot.
function recorder() {
  const events = [];
  const ctx = {
    font: '', textAlign: '', fillStyle: '', strokeStyle: '', lineWidth: 1,
    save() {}, restore() {}, setTransform() {},
    fillRect(x, y, w, h) { events.push({ type: 'rect', x, y, w, h }); },
    strokeRect(x, y, w, h) { events.push({ type: 'rect', x, y, w, h }); },
    fillText(text, x, y) { events.push({ type: 'text', text, x, y }); }
  };
  return { ctx, events };
}

function withSlot(rect, run) {
  const previous = { window: globalThis.window, document: globalThis.document };
  globalThis.window = { devicePixelRatio: 1 };
  globalThis.document = rect ? { getElementById: () => ({ getBoundingClientRect: () => ({ ...rect }) }) } : { getElementById: () => null };
  try { return run(); } finally {
    globalThis.window = previous.window;
    globalThis.document = previous.document;
  }
}

function player() {
  return { id: 'p1', hp: 80, maxHp: 100, level: 3, credits: 42, xpIntoLevel: 10, xpNeeded: 120, abilityName: 'Conduit Pulse', abilityCooldown: 0 };
}

function state(zone = { kind: 'haven' }) {
  const me = player();
  return { playerId: 'p1', players: { p1: me }, localPlayer: me, zone };
}

test('the compact HUD fits inside a phone-sized slot', () => {
  const rect = { left: 104, top: 10, width: 152, height: 48 };
  const { ctx, events } = recorder();
  withSlot(rect, () => drawHud(ctx, state(), 360));

  const texts = events.filter((event) => event.type === 'text').map((event) => event.text);
  assert.ok(texts.includes('LV 3'), 'level is shown');
  assert.ok(texts.includes('CR 42'), 'credits are shown');
  assert.ok(texts.includes('10/120 XP'), 'XP is shown');
  assert.ok(!texts.includes('SAFE CITY'), 'compact card drops the zone label');

  const rects = events.filter((event) => event.type === 'rect');
  assert.ok(rects.length > 3, 'bars and frame are drawn');
  for (const box of rects) {
    assert.ok(box.x >= rect.left - 1 && box.x + box.w <= rect.left + rect.width + 1, 'horizontal bounds: ' + JSON.stringify(box));
    assert.ok(box.y >= rect.top - 1 && box.y + box.h <= rect.top + rect.height + 1, 'vertical bounds: ' + JSON.stringify(box));
  }
});

test('the full HUD returns on a desktop-sized slot', () => {
  const rect = { left: 285, top: 10, width: 330, height: 64 };
  const { ctx, events } = recorder();
  withSlot(rect, () => drawHud(ctx, state(), 900));

  const texts = events.filter((event) => event.type === 'text').map((event) => event.text);
  assert.ok(texts.some((text) => text.includes('SAFE CITY')), 'zone label is shown');
  assert.ok(texts.includes('READY'), 'ability state is shown');
  assert.ok(texts.some((text) => text.includes('CONDUIT PULSE')), 'ability name is shown');
});

test('the HUD falls back to fixed coordinates without a DOM slot', () => {
  const { ctx, events } = recorder();
  withSlot(null, () => drawHud(ctx, state(), 900));
  const texts = events.filter((event) => event.type === 'text').map((event) => event.text);
  assert.ok(texts.includes('HP 80/100'), 'fallback slot still renders the full card');
});

test('nothing renders before an operative joins', () => {
  const { ctx, events } = recorder();
  withSlot({ left: 0, top: 0, width: 300, height: 64 }, () => drawHud(ctx, { players: {}, playerId: null }, 800));
  assert.equal(events.length, 0);
});

test('zone labels stay short enough for the radar strip', () => {
  assert.equal(zoneLabel({ kind: 'haven' }), 'SAFE CITY');
  assert.equal(zoneLabel({ kind: 'tower' }), 'TOWER');
  assert.equal(zoneLabel({ kind: 'wild', levelBand: [5, 9] }), 'WILDERNESS LV 5–9');
});

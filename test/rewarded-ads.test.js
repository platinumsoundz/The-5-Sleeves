// Rewarded adverts are money-adjacent, so these tests pin the server rules:
// no reward without a valid, fresh, single-use token claimed in the right
// place, within the daily caps.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHookBus } from '../server/hook-bus.js';
import rewardedAds from '../server/modules/rewarded-ads.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const { OFFERS, MIN_WATCH_MS, TOKEN_TTL_MS, RALLY_WINDOW_MS } = rewardedAds;

function useClock(t) {
  let now = 1700000000000;
  const real = Date.now;
  Date.now = () => now;
  t.after(() => { Date.now = real; });
  return { advance(ms) { now += ms; }, get now() { return now; } };
}

function socketSpy() {
  return {
    events: [],
    emit(name, payload) { this.events.push({ name, payload }); },
    last(name) { return [...this.events].reverse().find((event) => event.name === name); }
  };
}

function boot() {
  const hooks = createHookBus();
  const sockets = {};
  const socket = socketSpy();
  const zone = { id: 'haven-perimeter', kind: 'haven', players: {}, towerRun: null, broadcasts: 0, broadcast() { this.broadcasts += 1; } };
  let currentZone = zone;
  let persisted = 0;
  rewardedAds.setup({
    on: (event, handler) => hooks.on(event, handler),
    registerSocket: (name, handler) => { sockets[name] = handler; },
    playerZone: () => currentZone,
    persistPlayer: () => { persisted += 1; },
    playerSockets: () => ({ p1: socket })
  });
  return {
    hooks, sockets, zone, socket,
    get persisted() { return persisted; },
    setZone(next) { currentZone = next; }
  };
}

function operative(overrides = {}) {
  return { id: 'p1', hp: 100, maxHp: 100, credits: 40, adCounts: {}, adLastAt: {}, ...overrides };
}

function offers(app) {
  return app.socket.last('ad:offers')?.payload?.offers || [];
}

function offer(app, id) {
  return offers(app).find((entry) => entry.id === id) || {};
}

function towerZone(player) {
  return { id: 'tower-coast', kind: 'tower', players: { p1: player }, towerRun: { state: 'active' }, broadcasts: 0, broadcast() { this.broadcasts += 1; } };
}

test('offers are listed on join and only the safe-city ones are ready', (t) => {
  useClock(t);
  const app = boot();
  const player = operative();
  app.hooks.emit('joined', player, app.socket);

  assert.deepEqual(offers(app).map((entry) => entry.id).sort(), ['overcharge', 'rally', 'supply']);
  assert.equal(offer(app, 'supply').ready, true);
  assert.equal(offer(app, 'overcharge').ready, true);
  assert.equal(offer(app, 'rally').ready, false, 'no revive offer outside a tower death');

  app.setZone({ id: 'wild-perimeter', kind: 'wild', players: { p1: player }, broadcast() {} });
  app.hooks.emit('zoneChanged', player, app.socket);
  assert.equal(offer(app, 'supply').ready, false, 'supply transmissions are safe-city only');
});

test('a supply claim pays only after a watched transmission', (t) => {
  const clock = useClock(t);
  const app = boot();
  const player = operative({ credits: 40 });
  app.hooks.emit('joined', player, app.socket);

  app.sockets['ad:request'](player, { offerId: 'supply' }, app.socket);
  const first = app.socket.last('ad:grant').payload;
  assert.ok(first.token, 'a token is issued');

  app.sockets['ad:claim'](player, { token: first.token }, app.socket);
  assert.equal(player.credits, 40, 'an instant claim does not pay');
  assert.match(app.socket.last('ad:denied').payload.reason, /too short/i);

  // The burned token cannot be replayed; a real watch earns the reward once.
  app.sockets['ad:request'](player, { offerId: 'supply' }, app.socket);
  const second = app.socket.last('ad:grant').payload;
  clock.advance(MIN_WATCH_MS);
  app.sockets['ad:claim'](player, { token: second.token }, app.socket);
  assert.equal(player.credits, 140);
  assert.equal(player.adCounts.supply, 1);
  assert.equal(app.persisted, 1, 'the balance is saved');
  assert.equal(app.socket.last('ad:reward').payload.credits, 100);

  // Replaying the paid token changes nothing.
  app.sockets['ad:claim'](player, { token: second.token }, app.socket);
  assert.equal(player.credits, 140);
});

test('daily caps and cooldowns stop repeated farming', (t) => {
  const clock = useClock(t);
  const app = boot();
  const player = operative({ adDay: new Date().toISOString().slice(0, 10), adCounts: { supply: OFFERS.supply.dailyCap } });
  app.hooks.emit('joined', player, app.socket);
  app.sockets['ad:request'](player, { offerId: 'supply' }, app.socket);
  assert.match(app.socket.last('ad:denied').payload.reason, /limit/i);

  const fresh = operative({ adDay: new Date().toISOString().slice(0, 10), adLastAt: { supply: clock.now } });
  app.sockets['ad:request'](fresh, { offerId: 'supply' }, app.socket);
  assert.match(app.socket.last('ad:denied').payload.reason, /recharging/i);
});

test('the shield overcharge is granted and timed', (t) => {
  const clock = useClock(t);
  const app = boot();
  const player = operative();
  app.hooks.emit('joined', player, app.socket);

  app.sockets['ad:request'](player, { offerId: 'overcharge' }, app.socket);
  const grant = app.socket.last('ad:grant').payload;
  clock.advance(MIN_WATCH_MS);
  app.sockets['ad:claim'](player, { token: grant.token }, app.socket);

  assert.equal(player.shieldUntil, clock.now + OFFERS.overcharge.shieldMs);
  assert.equal(app.socket.last('ad:reward').payload.shieldMs, OFFERS.overcharge.shieldMs);
});

test('a tower death arms the revive window and payouts revive in place', (t) => {
  const clock = useClock(t);
  const app = boot();
  const player = operative({ hp: 0, respawnAt: clock.now + 5000, maxHp: 100 });
  const tower = towerZone(player);
  app.setZone(tower);
  app.hooks.emit('joined', player, app.socket);

  app.hooks.emit('tick', tower, clock.now, 0.05);
  assert.equal(player.respawnAt, clock.now + RALLY_WINDOW_MS, 'the return trip is held for the offer');
  assert.equal(offer(app, 'rally').ready, true);

  app.sockets['ad:request'](player, { offerId: 'rally' }, app.socket);
  const grant = app.socket.last('ad:grant').payload;
  assert.equal(player.respawnAt, clock.now + TOKEN_TTL_MS, 'death is held while the ad plays');

  clock.advance(MIN_WATCH_MS);
  app.sockets['ad:claim'](player, { token: grant.token }, app.socket);
  assert.equal(player.hp, 60, 'rejoins at 60% health');
  assert.equal(player.respawnAt, 0, 'the normal trip home is cancelled');
  assert.equal(player.rallyArmed, false);
  assert.equal(app.socket.last('ad:reward').payload.revived, true);
  assert.ok(tower.broadcasts > 0, 'the zone sees the revive');
});

test('a revive claim is refused once the operative has left the tower', (t) => {
  const clock = useClock(t);
  const app = boot();
  const player = operative({ hp: 0, respawnAt: clock.now + 5000 });
  const tower = towerZone(player);
  app.setZone(tower);
  app.hooks.emit('tick', tower, clock.now, 0.05);
  app.sockets['ad:request'](player, { offerId: 'rally' }, app.socket);
  const grant = app.socket.last('ad:grant').payload;

  app.setZone({ id: 'haven-perimeter', kind: 'haven', players: { p1: player }, broadcast() {} });
  clock.advance(MIN_WATCH_MS);
  app.sockets['ad:claim'](player, { token: grant.token }, app.socket);
  assert.equal(player.hp, 0, 'no free revive from another zone');
  assert.match(app.socket.last('ad:denied').payload.reason, /left the supply channel/i);
});

test('dismissing the transmission releases the death hold', (t) => {
  const clock = useClock(t);
  const app = boot();
  const player = operative({ hp: 0, respawnAt: clock.now + 5000 });
  const tower = towerZone(player);
  app.setZone(tower);
  app.hooks.emit('tick', tower, clock.now, 0.05);
  app.sockets['ad:request'](player, { offerId: 'rally' }, app.socket);
  const grant = app.socket.last('ad:grant').payload;

  app.sockets['ad:abandon'](player, { token: grant.token }, app.socket);
  assert.ok(player.respawnAt <= clock.now + 500, 'the respawn continues immediately');
});

test('saved counters survive a reconnect so caps cannot be reset', (t) => {
  const clock = useClock(t);
  const app = boot();
  const profile = {
    adDay: new Date().toISOString().slice(0, 10),
    adCounts: { supply: 4 },
    adLastAt: { supply: clock.now }
  };
  const player = operative();
  app.hooks.emit('joining', player, profile);
  assert.equal(player.adCounts.supply, 4, 'counters are restored before the day check');
  app.hooks.emit('joined', player, app.socket);
  assert.equal(offer(app, 'supply').used, 4);
  assert.equal(offer(app, 'supply').ready, false, 'the saved cooldown still applies');
});

test('safety floors and caps are configured', () => {
  assert.ok(MIN_WATCH_MS >= 5000, 'an instant claim can never count as a watch');
  assert.ok(TOKEN_TTL_MS > MIN_WATCH_MS);
  for (const offer of Object.values(OFFERS)) {
    assert.ok(offer.dailyCap > 0 && offer.dailyCap <= 12, 'every offer has a sane daily cap');
    assert.ok(offer.cooldownMs >= 0);
  }
});

// Site verification is a deployment concern, but the files must ship with the app.
test('the AdSense verification surfaces are served', () => {
  const html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
  assert.match(html, /google-adsense-account" content="ca-pub-8267279636493149"/, 'verification meta tag');
  assert.match(html, /adsbygoogle\.js\?client=ca-pub-8267279636493149/, 'ad script tag');
  const ads = fs.readFileSync(path.join(root, 'public', 'ads.txt'), 'utf8');
  assert.match(ads, /^google\.com, pub-8267279636493149, DIRECT, f08c47fec0942fa0$/m);
  const robots = fs.readFileSync(path.join(root, 'public', 'robots.txt'), 'utf8');
  assert.match(robots, /Mediapartners-Google/);
});

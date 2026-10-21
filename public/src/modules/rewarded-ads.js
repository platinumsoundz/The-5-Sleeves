// Opt-in rewarded adverts (client half). Buttons only appear where the server
// says an offer is ready — a safe city, or a tower death with a short revive
// window — so an ad can never interrupt combat. The server module pays; this
// file is presentation, handshake and UI state only.
import { adsAvailable, configureAds, playRewarded } from '../ads-rewarded.js';
import { createAdUi } from '../ads-ui.js';

// Never draw over the title, menu, shop or arena panels (they sit above us).
function blocked() {
  const open = (id) => {
    const element = document.getElementById(id);
    return !!element && !element.classList.contains('hidden');
  };
  return open('title-screen') || open('character-menu') || open('shop-panel') || open('arena-panel') || open('chat-panel');
}

export default {
  name: 'rewarded-ads',
  summary: 'Optional AdSense supply transmissions: credits, shield overcharge, tower revives.',
  priority: 65,
  setup(ctx) {
    const { state } = ctx;
    const socket = state.socket;
    if (!socket) return; // spectator/replay clients never join a roster
    configureAds();

    const ui = createAdUi(ctx.dom);
    let offers = [];
    let zoneKind = null;
    let rallyWindowMs = 12000;
    let busy = false;
    let panelOpen = false;
    let dismissed = false;
    let deadline = 0;
    let token = null;

    function note(text, color = '#ffd479') {
      const feed = state.killFeed || (state.killFeed = []);
      feed.push({ text, at: performance.now(), color });
    }

    function settle() {
      busy = false;
      token = null;
      ui.watchButton.disabled = false;
      ui.hint.textContent = '';
    }

    function request(offerId) {
      if (busy) return;
      busy = true;
      ui.hint.textContent = 'OPENING TRANSMISSION…';
      ui.watchButton.disabled = true;
      socket.emit('ad:request', { offerId });
      // A dropped connection must not leave the UI stuck forever.
      setTimeout(() => { if (busy && !token) settle(); }, 8000);
    }

    socket.on('ad:offers', (payload) => {
      offers = Array.isArray(payload?.offers) ? payload.offers : [];
      zoneKind = payload?.zoneKind || null;
      rallyWindowMs = Number(payload?.rallyWindowMs) || 12000;
    });

    socket.on('ad:grant', async (payload) => {
      if (!payload?.token || !payload.offerId) { settle(); return; }
      token = payload.token;
      const status = await playRewarded(payload.offerId, { simulatedDelayMs: (payload.minWatchMs || 5000) + 250 });
      if (status === 'viewed') {
        socket.emit('ad:claim', { token: payload.token });
        ui.hint.textContent = 'CONNECTING…';
        return;
      }
      socket.emit('ad:abandon', { token: payload.token });
      note(status === 'dismissed' ? 'TRANSMISSION CLOSED · NO REWARD' : 'SUPPLY CHANNEL UNAVAILABLE', '#ff9bad');
      settle();
    });

    // Credit payouts already show in the feed via credit-feedback.
    socket.on('ad:reward', (payload) => {
      if (payload?.revived) note('SIGNAL RESTORED · REJOINED', '#8effe6');
      if (payload?.shieldMs) note('SHIELD OVERCHARGE · ' + Math.round(payload.shieldMs / 1000) + 's', '#8effe6');
      settle();
    });

    socket.on('ad:denied', (payload) => {
      note(String(payload?.reason || 'SUPPLY CHANNEL UNAVAILABLE').toUpperCase(), '#ff9bad');
      settle();
    });

    ui.creditButton.addEventListener('click', () => request('supply'));
    ui.shieldButton.addEventListener('click', () => request('overcharge'));
    ui.watchButton.addEventListener('click', () => request('rally'));
    ui.leaveButton.addEventListener('click', () => {
      dismissed = true;
      panelOpen = false;
      ui.panel.style.display = 'none';
      socket.emit('ad:skip');
    });

    function update() {
      const player = state.localPlayer;
      const playing = !!state.playerId && !!player && !blocked();
      const dead = !!player && player.hp <= 0;
      if (!dead) dismissed = false;
      const offer = (id) => offers.find((entry) => entry.id === id) || null;

      const supply = offer('supply');
      const shield = offer('overcharge');
      // Never dangle a button the browser cannot honour (blocked/not approved).
      const ready = adsAvailable();
      const showBar = playing && ready && !dead && zoneKind === 'haven' && !panelOpen && !!(supply?.ready || shield?.ready || busy);
      ui.bar.style.display = showBar ? 'flex' : 'none';
      for (const [button, entry] of [[ui.creditButton, supply], [ui.shieldButton, shield]]) {
        button.disabled = busy || !entry?.ready;
        button.style.opacity = button.disabled ? '.45' : '1';
      }

      const towerDeath = playing && dead && zoneKind === 'tower' && !dismissed;
      if (!towerDeath) {
        if (panelOpen) { ui.panel.style.display = 'none'; panelOpen = false; }
        return;
      }
      if (!panelOpen) {
        panelOpen = true;
        deadline = Date.now() + rallyWindowMs;
        ui.panel.style.display = 'block';
      }
      if (!ready) {
        ui.watchButton.style.display = 'none';
        ui.copy.textContent = 'Supply channel unavailable. Return to your last city.';
        return;
      }
      ui.watchButton.style.display = '';
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      ui.watchButton.textContent = left > 0 ? 'WATCH · REJOIN ' + left + 's' : 'WATCH · REJOIN';
      ui.watchButton.disabled = busy || left <= 0;
      ui.copy.textContent = left > 0
        ? 'Wait for a supply transmission to rejoin the fight, or return to your last city.'
        : 'The supply channel is closing. Return to your last city.';
    }

    ctx.on('frame', update);
  }
};

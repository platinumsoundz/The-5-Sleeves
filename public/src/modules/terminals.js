// Archive terminals client half (roadmap #10): draws the terminal beacons,
// shows a READ prompt when the operative is close, and opens the lore log
// panel on read. Pairs with server/modules/archive-terminals.js.
// Canon rules for the lore text live in memory/02-universe-canon.md.
import { nearestTerminal } from '../world.js';

const PANEL_CSS = 'left:50%;bottom:120px;transform:translateX(-50%);width:min(480px,88vw);background:rgba(9,16,20,.95);border:1px solid rgba(119,255,214,.5);border-radius:10px;padding:16px 18px;color:#d9fff5;font:13px/1.55 system-ui,sans-serif;z-index:40;';
const PROMPT_CSS = 'left:50%;bottom:150px;transform:translateX(-50%);background:rgba(9,16,20,.88);border:1px solid rgba(119,255,214,.55);border-radius:8px;padding:7px 14px;color:#9fffe2;font:700 12px system-ui,sans-serif;letter-spacing:.1em;pointer-events:none;';

function drawBeacon(draw, terminal, read, time) {
  const pulse = 0.5 + 0.5 * Math.sin(time * 0.003 + terminal.x);
  draw.save();
  draw.translate(terminal.x, terminal.y);
  draw.strokeStyle = read ? 'rgba(120,190,175,.45)' : 'rgba(119,255,214,.9)';
  draw.lineWidth = 1.5;
  draw.beginPath(); draw.arc(0, 0, 16 + pulse * 4, 0, Math.PI * 2); draw.stroke();
  draw.fillStyle = read ? 'rgba(90,140,130,.35)' : 'rgba(60,255,210,.3)';
  draw.fillRect(-7, -10, 14, 20);
  draw.strokeStyle = read ? '#7a9c94' : '#78ffd6';
  draw.strokeRect(-7, -10, 14, 20);
  draw.beginPath(); draw.moveTo(-3, -4); draw.lineTo(3, -4); draw.moveTo(-3, 0); draw.lineTo(3, 0); draw.moveTo(-3, 4); draw.lineTo(1, 4); draw.stroke();
  draw.restore();
}

export default {
  name: 'terminals',
  summary: 'Terminal beacons, READ prompt and the lore log panel.',
  priority: 40,
  setup(ctx) {
    const prompt = ctx.dom(PROMPT_CSS + 'display:none;');
    const panel = ctx.dom(PANEL_CSS + 'display:none;');
    let panelTimer = null;

    function closePanel() { panel.style.display = 'none'; if (panelTimer) clearTimeout(panelTimer); }

    function openPanel(payload) {
      panel.innerHTML = '';
      const title = document.createElement('div');
      title.textContent = payload.name;
      title.style.cssText = 'font-weight:800;letter-spacing:.08em;color:#8ffff0;margin-bottom:8px;';
      const log = document.createElement('div');
      log.textContent = payload.log;
      const footer = document.createElement('div');
      footer.style.cssText = 'margin-top:10px;color:#7fb8ac;font-size:11px;';
      footer.textContent = payload.firstRead
        ? 'FIRST READ · +' + payload.xp + ' XP · +12 CORE CHARGE · ' + payload.read + '/' + payload.total + ' ARCHIVED'
        : 'ALREADY ARCHIVED · ' + payload.read + '/' + payload.total + ' · NO REWARD';
      const close = document.createElement('button');
      close.type = 'button';
      close.textContent = 'CLOSE [F]';
      close.style.cssText = 'margin-top:10px;padding:5px 12px;border:1px solid rgba(119,255,214,.5);border-radius:6px;background:none;color:#9fffe2;font:700 11px system-ui,sans-serif;cursor:pointer;';
      close.addEventListener('click', closePanel);
      panel.append(title, log, footer, close);
      panel.style.display = 'block';
      if (panelTimer) clearTimeout(panelTimer);
      panelTimer = setTimeout(closePanel, 30000);
    }

    ctx.on('render:world', ({ ctx: draw, state, time }) => {
      for (const terminal of state.terminals || []) drawBeacon(draw, terminal, (state.terminalsRead || []).includes(terminal.id), time);
    });

    ctx.on('frame', ({ state }) => {
      const near = nearestTerminal(state.terminals, state.localPlayer);
      if (near && !(state.terminalsRead || []).includes(near.id)) {
        prompt.textContent = 'F · READ ' + near.name.toUpperCase();
        prompt.style.display = 'block';
      } else {
        prompt.style.display = 'none';
      }
    });

    // F / Y / READ pressed: if the log panel is open, close it and swallow
    // the server's reply so it does not immediately reopen. Otherwise let the
    // normal input → network path send player:interact.
    let swallowNext = false;
    ctx.on('action', (name) => {
      if (name !== 'interact') return;
      if (panel.style.display !== 'none') { closePanel(); swallowNext = true; }
    });

    ctx.on('net:terminal', (payload) => {
      if (swallowNext) { swallowNext = false; return; }
      if (payload?.found) openPanel(payload);
    });

    window.addEventListener('keydown', (event) => { if (event.key === 'Escape') closePanel(); });
  }
};

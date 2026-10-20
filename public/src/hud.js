// Top-centre stat readout. One slot, two layouts: the full card on desktop and
// a compact card when the slot is narrow or short (phones), so the HUD never
// crowds the radar or the MENU/CHAT chips in the corners.

const FULL_WIDTH = 330; // widest the readout grows on desktop
const FULL_HEIGHT = 64; // design height of the full card
const COMPACT_WIDTH = 220; // below this width the compact card reads better
const COMPACT_HEIGHT = 58; // below this height the compact card reads better

// Read a DOM slot so canvas readouts line up with the CSS layout. Falls back to
// fixed coordinates when the DOM is unavailable (tests/SSR).
export function slotRect(id, fallback) {
  const element = typeof document !== 'undefined' ? document.getElementById(id) : null;
  if (!element || typeof element.getBoundingClientRect !== 'function') return fallback;
  const rect = element.getBoundingClientRect();
  if (!rect || rect.width <= 0 || rect.height <= 0) return fallback;
  return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
}

export function zoneLabel(zone) {
  if (zone?.kind === 'haven') return 'SAFE CITY';
  if (zone?.kind === 'arena') return 'ARENA';
  if (zone?.kind === 'tower') return 'TOWER';
  return 'WILDERNESS' + (zone?.levelBand ? ' LV ' + zone.levelBand[0] + '–' + zone.levelBand[1] : '');
}

function frame(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(6,17,26,.74)'; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(118,255,224,.28)'; ctx.lineWidth = 1;
  ctx.strokeRect(x + .5, y + .5, w - 1, h - 1);
}

function bar(ctx, x, y, w, h, track, ratio) {
  ctx.fillStyle = track; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#f25d75';
  ctx.fillRect(x, y, w * Math.max(0, Math.min(1, ratio)), h);
}

// Full card: HP bar + level, credits/zone/ability, XP bar.
function drawFull(ctx, player, state, x, y, w, h) {
  ctx.textAlign = 'left'; ctx.font = 'bold 10px system-ui';
  bar(ctx, x + 8, y + 8, w - 92, 8, 'rgba(66,30,42,.95)', player.hp / Math.max(1, player.maxHp));
  ctx.fillStyle = '#fff'; ctx.fillText('HP ' + Math.ceil(player.hp) + '/' + player.maxHp, x + 12, y + 14.5);
  ctx.fillStyle = '#ffe9a0'; ctx.textAlign = 'right'; ctx.font = 'bold 11px system-ui';
  ctx.fillText('LV ' + (player.level || 1), x + w - 9, y + 16);
  ctx.fillStyle = '#ffd479'; ctx.textAlign = 'left'; ctx.font = 'bold 10px system-ui';
  ctx.fillText('CR ' + Math.floor(player.credits || 0), x + 8, y + 31);
  ctx.fillStyle = '#61ffe0';
  ctx.fillText('· ' + zoneLabel(state.zone), x + 52, y + 31);
  ctx.fillStyle = '#8faeb0'; ctx.textAlign = 'right'; ctx.font = '9px system-ui';
  ctx.fillText(String(player.abilityName || 'SLEEVE').toUpperCase(), x + w - 8, y + 31);
  const xpY = y + h - 25;
  ctx.fillStyle = 'rgba(64,52,24,.9)'; ctx.fillRect(x + 8, xpY, w - 16, 5);
  ctx.fillStyle = '#ffc857';
  ctx.fillRect(x + 8, xpY, (w - 16) * Math.min(1, (player.xpIntoLevel || 0) / Math.max(1, player.xpNeeded || 1)), 5);
  ctx.fillStyle = '#ffe9c0'; ctx.textAlign = 'left'; ctx.font = '9px system-ui';
  ctx.fillText((player.xpIntoLevel || 0) + '/' + (player.xpNeeded || 0) + ' XP', x + 8, y + h - 8);
  const cooldown = player.abilityCooldown || 0;
  ctx.textAlign = 'right'; ctx.fillStyle = cooldown > 0 ? '#8faeb0' : '#7dffe4';
  ctx.fillText(cooldown > 0 ? (cooldown / 1000).toFixed(1) + 's' : 'READY', x + w - 8, y + h - 8);
}

// Compact card for phones: level + HP, then credits and XP, with the XP bar as
// a thin strip along the bottom. The zone label lives in the radar standfirst.
function drawCompact(ctx, player, x, y, w, h) {
  const hpText = Math.ceil(player.hp) + '/' + player.maxHp;
  ctx.textAlign = 'left'; ctx.font = 'bold 9px system-ui';
  ctx.fillStyle = '#ffe9a0'; ctx.fillText('LV ' + (player.level || 1), x + 7, y + 12);
  ctx.textAlign = 'right'; ctx.fillStyle = '#fff';
  ctx.fillText(hpText, x + w - 7, y + 12);
  ctx.fillStyle = 'rgba(66,30,42,.95)'; ctx.fillRect(x + 7, y + 16, w - 14, 6);
  ctx.fillStyle = '#f25d75';
  ctx.fillRect(x + 7, y + 16, (w - 14) * Math.max(0, player.hp / Math.max(1, player.maxHp)), 6);
  ctx.textAlign = 'left'; ctx.font = 'bold 9px system-ui'; ctx.fillStyle = '#ffd479';
  ctx.fillText('CR ' + Math.floor(player.credits || 0), x + 7, y + h - 10);
  ctx.textAlign = 'right'; ctx.fillStyle = '#ffe9c0'; ctx.font = '9px system-ui';
  ctx.fillText((player.xpIntoLevel || 0) + '/' + (player.xpNeeded || 0) + ' XP', x + w - 7, y + h - 10);
  ctx.fillStyle = 'rgba(64,52,24,.9)'; ctx.fillRect(x + 7, y + h - 5, w - 14, 3);
  ctx.fillStyle = '#ffc857';
  ctx.fillRect(x + 7, y + h - 5, (w - 14) * Math.min(1, (player.xpIntoLevel || 0) / Math.max(1, player.xpNeeded || 1)), 3);
}

export function drawHud(ctx, state, width) {
  const player = state.players[state.playerId] || state.localPlayer;
  if (!player) return;
  ctx.save(); ctx.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0);
  const slot = slotRect('hud-center', { x: width / 2 - FULL_WIDTH / 2, y: 10, width: 300, height: FULL_HEIGHT });
  const w = Math.round(Math.max(132, Math.min(FULL_WIDTH, slot.width || 300)));
  const h = Math.round(Math.max(40, Math.min(FULL_HEIGHT + 8, slot.height || FULL_HEIGHT)));
  const x = Math.max(6, Math.min(width - w - 6, slot.x + (slot.width - w) / 2)), y = slot.y;
  frame(ctx, x, y, w, h);
  if (w < COMPACT_WIDTH || h < COMPACT_HEIGHT) drawCompact(ctx, player, x, y, w, h);
  else drawFull(ctx, player, state, x, y, w, h);
  ctx.restore();
}

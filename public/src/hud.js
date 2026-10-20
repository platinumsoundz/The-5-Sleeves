// Compact top-centre operative summary plus the thin, full-width XP progress line.
const FULL_WIDTH = 330;
const FULL_HEIGHT = 42;
const COMPACT_WIDTH = 220;
const COMPACT_HEIGHT = 34;
const XP_BAR_HEIGHT = 3;

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

function drawXpBar(ctx, player, width) {
  const progress = Math.max(0, Math.min(1, (player.xpIntoLevel || 0) / Math.max(1, player.xpNeeded || 1)));
  ctx.fillStyle = 'rgba(255,200,87,.2)';
  ctx.fillRect(0, 0, width, XP_BAR_HEIGHT);
  ctx.fillStyle = '#ffc857';
  ctx.fillRect(0, 0, width * progress, XP_BAR_HEIGHT);
}

function drawSummary(ctx, player, state, x, y, width, height) {
  ctx.fillStyle = 'rgba(6,17,26,.72)'; ctx.fillRect(x, y, width, height);
  ctx.strokeStyle = 'rgba(118,255,224,.25)'; ctx.lineWidth = 1;
  ctx.strokeRect(x + .5, y + .5, width - 1, height - 1);
  ctx.textAlign = 'left'; ctx.font = 'bold 10px system-ui'; ctx.fillStyle = '#ffe9a0';
  ctx.fillText('LV ' + (player.level || 1), x + 9, y + 14);
  ctx.fillStyle = '#ffd479'; ctx.textAlign = 'right';
  ctx.fillText('CR ' + Math.floor(player.credits || 0), x + width - 9, y + 14);
  ctx.textAlign = 'left'; ctx.font = '9px system-ui'; ctx.fillStyle = '#61ffe0';
  ctx.fillText(zoneLabel(state.zone), x + 9, y + height - 8);
  ctx.textAlign = 'right'; ctx.fillStyle = (player.abilityCooldown || 0) > 0 ? '#8faeb0' : '#7dffe4';
  const cooldown = player.abilityCooldown || 0;
  const ability = String(player.abilityName || 'SLEEVE').toUpperCase();
  ctx.fillText(ability + ' · ' + (cooldown > 0 ? (cooldown / 1000).toFixed(1) + 's' : 'READY'), x + width - 9, y + height - 8);
}

export function drawHud(ctx, state, width) {
  const player = state.players[state.playerId] || state.localPlayer;
  if (!player) return;
  ctx.save(); ctx.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0);
  drawXpBar(ctx, player, width);
  const slot = slotRect('hud-center', { x: width / 2 - FULL_WIDTH / 2, y: 8, width: 300, height: FULL_HEIGHT });
  const panelWidth = Math.round(Math.max(132, Math.min(FULL_WIDTH, slot.width || 300)));
  const panelHeight = panelWidth < COMPACT_WIDTH ? COMPACT_HEIGHT : FULL_HEIGHT;
  const x = Math.max(6, Math.min(width - panelWidth - 6, slot.x + (slot.width - panelWidth) / 2));
  const y = Math.max(XP_BAR_HEIGHT + 4, slot.y);
  drawSummary(ctx, player, state, x, y, panelWidth, panelHeight);
  ctx.restore();
}

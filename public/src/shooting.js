export const SHOOTING_MODE = Object.freeze({ AUTO: 'auto-aim', TWIN: 'twin-stick' });
export const FIRE_REPEAT_MS = 500; // Above the server's 450 ms limit to avoid rejected repeat shots.
const MODE_KEY = 'the5sleeves.shooting-mode.v1';
const AUTO_AIM_RANGE = 560;

export function normalizeMode(value) {
  return value === SHOOTING_MODE.TWIN ? SHOOTING_MODE.TWIN : SHOOTING_MODE.AUTO;
}
export function getShootingMode() {
  try { return normalizeMode(localStorage.getItem(MODE_KEY)); } catch (_) { return SHOOTING_MODE.AUTO; }
}
export function setShootingMode(value) {
  const mode = normalizeMode(value);
  try { localStorage.setItem(MODE_KEY, mode); } catch (_) {}
  if (typeof document !== 'undefined') document.body?.classList.toggle('twin-stick', mode === SHOOTING_MODE.TWIN);
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('shooting-mode:changed', { detail: mode }));
  return mode;
}
export function normalizeAim(x, y) {
  const length = Math.hypot(x, y);
  return Number.isFinite(length) && length > 0.001 ? { x: x / length, y: y / length } : null;
}
export function shouldRepeatFire(now, lastShotAt) {
  return now - lastShotAt >= FIRE_REPEAT_MS;
}

// The client chooses a direction only; the server still decides collisions and damage.
export function autoAimVector(state) {
  const player = state.localPlayer || state.players?.[state.playerId];
  if (!player) return null;
  const zone = state.zone || {};
  const targets = Object.values(state.ai || {}).filter((target) => target.hp > 0);
  if (zone.arena && zone.alignment === 'pvp') {
    for (const other of Object.values(state.players || {})) {
      if (other.id === player.id || other.hp <= 0 || !player.arenaTeam || other.arenaTeam === player.arenaTeam) continue;
      targets.push(other);
    }
  }
  let nearest = null, nearestDistance = AUTO_AIM_RANGE;
  for (const target of targets) {
    const dx = target.x - player.x, dy = target.y - player.y;
    const away = Math.hypot(dx, dy);
    if (away > 0 && away < nearestDistance) { nearest = { dx, dy }; nearestDistance = away; }
  }
  return nearest ? normalizeAim(nearest.dx, nearest.dy) : null;
}

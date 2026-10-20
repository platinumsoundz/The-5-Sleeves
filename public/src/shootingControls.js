import { loadKeybinds } from './keybinds.js';
import { normalizeAim, shouldRepeatFire } from './shooting.js';

// Owns held-fire sources and the manual aim devices; callers still resolve the shot.
export function createShootingControls({ onFire, getMouseAim, setMode }) {
  const binds = loadKeybinds(), fireSources = new Set();
  let lastShotAt = 0, lastManualAim = null;
  window.addEventListener('keybinds:changed', () => Object.assign(binds, loadKeybinds()));
  function setFireSource(source, active) {
    const wasHeld = fireSources.size > 0;
    if (active) fireSources.add(source); else fireSources.delete(source);
    if (!wasHeld && fireSources.size) { lastShotAt = performance.now(); onFire(); }
  }
  const clearFire = () => fireSources.clear();
  window.addEventListener('keydown', (event) => {
    if (event.target?.closest?.('input, textarea') || document.body?.dataset?.menuOpen === 'true') return;
    if (event.code === binds.attack) { event.preventDefault(); setMode('keyboard'); setFireSource('keyboard', true); }
  });
  window.addEventListener('keyup', (event) => {
    if (event.code === binds.attack) setFireSource('keyboard', false);
  });
  window.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'mouse' && getMouseAim?.()) setMode('keyboard');
  });
  window.addEventListener('blur', clearFire);

  const attackButton = document.querySelector('.action-button[data-action="attack"]');
  if (attackButton) {
    attackButton.addEventListener('pointerdown', (event) => {
      event.preventDefault(); setMode('touch');
      attackButton.setPointerCapture(event.pointerId);
      setFireSource('touch-' + event.pointerId, true);
    });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((type) => attackButton.addEventListener(type,
      (event) => setFireSource('touch-' + event.pointerId, false)));
  }

  const base = document.getElementById('aim-joystick');
  const nub = document.getElementById('aim-joystick-nub');
  if (base && nub) {
    const moveNub = (x, y) => { nub.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)'; };
    const reset = () => { setFireSource('aim-stick', false); base.classList.remove('active'); moveNub(0, 0); };
    base.addEventListener('pointerdown', (event) => {
      event.preventDefault(); setMode('touch'); base.setPointerCapture(event.pointerId); base.classList.add('active');
    });
    base.addEventListener('pointermove', (event) => {
      if (!base.classList.contains('active')) return;
      event.preventDefault();
      const rect = base.getBoundingClientRect();
      let dx = event.clientX - rect.left - rect.width / 2, dy = event.clientY - rect.top - rect.height / 2;
      const length = Math.hypot(dx, dy), max = Math.max(24, rect.width * 0.34);
      const aim = length < 5 ? null : normalizeAim(dx, dy);
      if (aim) { lastManualAim = aim; setFireSource('aim-stick', true); }
      else setFireSource('aim-stick', false);
      if (length > max) { dx *= max / length; dy *= max / length; }
      moveNub(dx, dy);
    });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((type) => base.addEventListener(type, reset));
  }

  return {
    clearFire,
    update() {
      if (document.body?.dataset?.menuOpen === 'true') { clearFire(); return; }
      const now = performance.now();
      if (fireSources.size && shouldRepeatFire(now, lastShotAt)) { lastShotAt = now; onFire(); }
    },
    updateGamepad(pad, pressed = []) {
      const x = pad && Math.abs(pad.axes[2] || 0) >= 0.2 ? pad.axes[2] : 0;
      const y = pad && Math.abs(pad.axes[3] || 0) >= 0.2 ? pad.axes[3] : 0;
      const aim = normalizeAim(x, y);
      if (aim) lastManualAim = aim;
      if (pad && (aim || pressed.some(Boolean))) setMode('controller');
      setFireSource('gamepad', !!(pressed[0] || pressed[5]));
    },
    aimVector(mode) {
      if (mode === 'keyboard') return getMouseAim?.() || lastManualAim;
      return lastManualAim;
    }
  };
}

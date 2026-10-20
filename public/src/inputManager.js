// Pure analog-stick maths: turn a drag offset into a unit-scaled vector in any
// direction. Exported so Node tests can prove 360-degree movement without a DOM.
import { loadKeybinds } from './keybinds.js';
import { getShootingMode, normalizeAim, SHOOTING_MODE, shouldRepeatFire } from './shooting.js';

export function stickVector(dx, dy, max = 52, deadZone = 5) {
  const length = Math.hypot(dx, dy);
  if (!Number.isFinite(length) || length < deadZone || max <= 0) return { x: 0, y: 0 };
  const magnitude = Math.min(1, length / max);
  return { x: (dx / length) * magnitude, y: (dy / length) * magnitude };
}

export function createInputManager({ onAction, onMenu, onMode, audio, getMouseAim }) {
  const held = new Set(), fireSources = new Set();
  const binds = loadKeybinds();
  window.addEventListener('keybinds:changed', () => Object.assign(binds, loadKeybinds()));
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  let mode = hasTouch ? 'touch' : 'keyboard';
  let padVector = { x: 0, y: 0 }, gamepadAim = null, lastShotAt = 0;
  let previousButtons = [], lastManualAim = null;
  const stick = { vector: { x: 0, y: 0 } }, aimStick = { vector: null };
  const setMode = (next) => { mode = next; onMode(next); };
  const setDirection = (direction, active) => active ? held.add(direction) : held.delete(direction);
  const triggerAction = (name) => { audio?.unlock(); audio?.play(name); onAction(name); };
  function setFireSource(source, active) {
    const wasHeld = fireSources.size > 0;
    if (active) fireSources.add(source); else fireSources.delete(source);
    if (!wasHeld && fireSources.size) { lastShotAt = performance.now(); triggerAction('attack'); }
  }
  document.body?.classList.toggle('twin-stick', getShootingMode() === SHOOTING_MODE.TWIN);
  window.addEventListener('pointermove', (event) => { if (event.pointerType === 'mouse' && getMouseAim?.()) setMode('keyboard'); });
  const directionButtons = { ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down', ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right' };

  // On-screen analog joystick: any drag direction becomes a vector, so the
  // player moves diagonally and in every angle (not four fixed directions).
  function setupJoystick() {
    const base = document.getElementById('joystick');
    const nub = document.getElementById('joystick-nub');
    if (!base || !nub) return;
    const moveNub = (x, y) => { nub.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)'; };
    const apply = (clientX, clientY) => {
      const rect = base.getBoundingClientRect();
      const centreX = rect.left + rect.width / 2, centreY = rect.top + rect.height / 2;
      const max = Math.max(24, rect.width * 0.34);
      let dx = clientX - centreX, dy = clientY - centreY;
      stick.vector = stickVector(dx, dy, max);
      const length = Math.hypot(dx, dy);
      if (length > max) { dx = dx / length * max; dy = dy / length * max; }
      moveNub(dx, dy);
    };
    const reset = () => {
      stick.vector = { x: 0, y: 0 };
      base.classList.remove('active');
      moveNub(0, 0);
    };
    base.addEventListener('pointerdown', (event) => {
      event.preventDefault(); audio?.unlock(); setMode('touch');
      base.setPointerCapture(event.pointerId); base.classList.add('active');
      apply(event.clientX, event.clientY);
    });
    base.addEventListener('pointermove', (event) => {
      if (!base.classList.contains('active')) return;
      event.preventDefault();
      apply(event.clientX, event.clientY);
    });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((type) => base.addEventListener(type, reset));
  }
  setupJoystick();

  function setupAimJoystick() {
    const base = document.getElementById('aim-joystick');
    const nub = document.getElementById('aim-joystick-nub');
    if (!base || !nub) return;
    const moveNub = (x, y) => { nub.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)'; };
    const reset = () => { aimStick.vector = null; base.classList.remove('active'); moveNub(0, 0); };
    base.addEventListener('pointerdown', (event) => {
      event.preventDefault(); audio?.unlock(); setMode('touch');
      base.setPointerCapture(event.pointerId); base.classList.add('active');
    });
    base.addEventListener('pointermove', (event) => {
      if (!base.classList.contains('active')) return;
      event.preventDefault();
      const rect = base.getBoundingClientRect();
      let dx = event.clientX - rect.left - rect.width / 2, dy = event.clientY - rect.top - rect.height / 2;
      const max = Math.max(24, rect.width * 0.34), length = Math.hypot(dx, dy);
      aimStick.vector = length < 5 ? null : normalizeAim(dx, dy);
      if (aimStick.vector) lastManualAim = aimStick.vector;
      if (length > max) { dx *= max / length; dy *= max / length; }
      moveNub(dx, dy);
    });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((type) => base.addEventListener(type, reset));
  }
  setupAimJoystick();

  document.querySelectorAll('.action-button').forEach((button) => {
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault(); setMode('touch');
      if (button.dataset.action === 'attack') {
        button.setPointerCapture(event.pointerId);
        setFireSource('touch-' + event.pointerId, true);
      } else triggerAction(button.dataset.action);
    });
    if (button.dataset.action === 'attack') {
      ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((type) => button.addEventListener(type, (event) => setFireSource('touch-' + event.pointerId, false)));
    }
  });

  window.addEventListener('keydown', (event) => {
    if (event.target?.closest?.('input, textarea')) return;
    const code = event.code;
    // The menu key always toggles, even while the menu is open. Everything
    // else belongs to the overlay (tabs, keybind capture, page buttons).
    if (code === binds.menu) { setMode('keyboard'); fireSources.clear(); event.preventDefault(); if (!event.repeat) onMenu(); return; }
    if (document.body?.dataset?.menuOpen === 'true') return;
    const direction = directionButtons[event.key];
    if (direction) { setMode('keyboard'); event.preventDefault(); setDirection(direction, true); }
    if (code === binds.attack) { setMode('keyboard'); event.preventDefault(); setFireSource('keyboard', true); }
    if (code === binds.dash || (binds.dash === 'ShiftLeft' && code === 'ShiftRight')) { setMode('keyboard'); event.preventDefault(); if (!event.repeat) triggerAction('dash'); }
    if (code === binds.shield) { setMode('keyboard'); if (!event.repeat) triggerAction('shield'); }
    if (code === binds.ability) { setMode('keyboard'); event.preventDefault(); if (!event.repeat) triggerAction('ability'); }
    if (code === binds.interact) { setMode('keyboard'); if (!event.repeat) triggerAction('interact'); }
    if (event.code === 'Escape') onMenu(false);
  });
  window.addEventListener('keyup', (event) => {
    const direction = directionButtons[event.key];
    if (direction) { setMode('keyboard'); event.preventDefault(); setDirection(direction, false); }
    if (event.code === binds.attack) setFireSource('keyboard', false);
  });

  const isPressed = (pad, index) => !!pad.buttons[index] && (pad.buttons[index].pressed || pad.buttons[index].value > 0.5);
  function updateGamepad() {
    if (!navigator.getGamepads) { setFireSource('gamepad', false); return; }
    const pad = Array.from(navigator.getGamepads()).find((item) => item?.connected);
    if (!pad) { padVector = { x: 0, y: 0 }; setFireSource('gamepad', false); return; }
    let x = Math.abs(pad.axes[0] || 0) < 0.18 ? 0 : pad.axes[0];
    let y = Math.abs(pad.axes[1] || 0) < 0.18 ? 0 : pad.axes[1];
    const left = isPressed(pad, 14), right = isPressed(pad, 15), up = isPressed(pad, 12), down = isPressed(pad, 13);
    if (left || right) x = Number(right) - Number(left);
    if (up || down) y = Number(down) - Number(up);
    const magnitude = Math.hypot(x, y);
    if (magnitude > 1) { x /= magnitude; y /= magnitude; }
    padVector = { x, y };
    const aimX = Math.abs(pad.axes[2] || 0) < 0.2 ? 0 : pad.axes[2];
    const aimY = Math.abs(pad.axes[3] || 0) < 0.2 ? 0 : pad.axes[3];
    gamepadAim = normalizeAim(aimX, aimY);
    if (gamepadAim) lastManualAim = gamepadAim;
    const pressed = Array.from({ length: pad.buttons.length }, (_, index) => isPressed(pad, index));
    const edge = (buttons) => buttons.some((index) => pressed[index] && !previousButtons[index]);
    if (magnitude || gamepadAim || pressed.some(Boolean)) setMode('controller');
    setFireSource('gamepad', pressed[0] || pressed[5]);
    if (edge([2, 4])) triggerAction('dash');
    if (edge([1, 6])) triggerAction('shield');
    if (edge([7, 10])) triggerAction('ability');
    if (edge([3])) triggerAction('interact'); // Y / triangle: read terminals
    if (edge([9, 8])) { fireSources.clear(); onMenu(); }
    previousButtons = pressed;
  }
  function update() {
    updateGamepad();
    if (document.body?.dataset?.menuOpen === 'true') { fireSources.clear(); return; }
    const now = performance.now();
    if (fireSources.size && shouldRepeatFire(now, lastShotAt)) {
      lastShotAt = now;
      triggerAction('attack');
    }
  }
  window.addEventListener('gamepadconnected', () => { previousButtons = []; setMode('controller'); });
  window.addEventListener('gamepaddisconnected', () => {
    previousButtons = []; padVector = { x: 0, y: 0 }; gamepadAim = null;
    setFireSource('gamepad', false);
    const another = navigator.getGamepads && Array.from(navigator.getGamepads()).some((item) => item?.connected);
    if (!another) setMode(hasTouch ? 'touch' : 'keyboard');
  });
  setMode(mode);

  return {
    update,
    aimVector() {
      if (mode === 'touch') return lastManualAim;
      if (mode === 'controller') return gamepadAim || lastManualAim;
      return getMouseAim?.() || lastManualAim;
    },
    vector() {
      if (mode === 'controller') return { ...padVector };
      if (mode === 'touch' && (stick.vector.x || stick.vector.y)) return { ...stick.vector };
      let x = Number(held.has('right')) - Number(held.has('left'));
      let y = Number(held.has('down')) - Number(held.has('up'));
      const length = Math.hypot(x, y);
      if (length > 1) { x /= length; y /= length; }
      return { x, y };
    }
  };
}

// Pure analog-stick maths: turn a drag offset into a unit-scaled vector in any
// direction. Exported so Node tests can prove 360-degree movement without a DOM.
import { loadKeybinds } from './keybinds.js';
import { createShootingControls } from './shootingControls.js';
import { getShootingMode, SHOOTING_MODE } from './shooting.js';

export function stickVector(dx, dy, max = 52, deadZone = 5) {
  const length = Math.hypot(dx, dy);
  if (!Number.isFinite(length) || length < deadZone || max <= 0) return { x: 0, y: 0 };
  const magnitude = Math.min(1, length / max);
  return { x: (dx / length) * magnitude, y: (dy / length) * magnitude };
}

export function createInputManager({ onAction, onMenu, onMode, audio, getMouseAim }) {
  const held = new Set(), binds = loadKeybinds();
  window.addEventListener('keybinds:changed', () => Object.assign(binds, loadKeybinds()));
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  let mode = hasTouch ? 'touch' : 'keyboard';
  let padVector = { x: 0, y: 0 }, previousButtons = [];
  const stick = { vector: { x: 0, y: 0 } };
  const setMode = (next) => { mode = next; onMode(next); };
  const setDirection = (direction, active) => active ? held.add(direction) : held.delete(direction);
  const triggerAction = (name) => { audio?.unlock(); audio?.play(name); onAction(name); };
  const shooting = createShootingControls({
    onFire: () => triggerAction('attack'), getMouseAim, setMode
  });
  document.body?.classList.toggle('twin-stick', getShootingMode() === SHOOTING_MODE.TWIN);
  const directionButtons = {
    ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down',
    ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right'
  };

  function setupMovementJoystick() {
    const base = document.getElementById('joystick'), nub = document.getElementById('joystick-nub');
    if (!base || !nub) return;
    const moveNub = (x, y) => { nub.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)'; };
    const apply = (clientX, clientY) => {
      const rect = base.getBoundingClientRect();
      let dx = clientX - rect.left - rect.width / 2, dy = clientY - rect.top - rect.height / 2;
      const max = Math.max(24, rect.width * 0.34), length = Math.hypot(dx, dy);
      stick.vector = stickVector(dx, dy, max);
      if (length > max) { dx *= max / length; dy *= max / length; }
      moveNub(dx, dy);
    };
    const reset = () => { stick.vector = { x: 0, y: 0 }; base.classList.remove('active'); moveNub(0, 0); };
    base.addEventListener('pointerdown', (event) => {
      event.preventDefault(); audio?.unlock(); setMode('touch');
      base.setPointerCapture(event.pointerId); base.classList.add('active'); apply(event.clientX, event.clientY);
    });
    base.addEventListener('pointermove', (event) => {
      if (base.classList.contains('active')) { event.preventDefault(); apply(event.clientX, event.clientY); }
    });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((type) => base.addEventListener(type, reset));
  }
  setupMovementJoystick();
  document.querySelectorAll('.action-button:not([data-action="attack"])').forEach((button) => {
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault(); setMode('touch'); triggerAction(button.dataset.action);
    });
  });

  window.addEventListener('keydown', (event) => {
    if (event.target?.closest?.('input, textarea')) return;
    const code = event.code;
    if (code === binds.menu) {
      setMode('keyboard'); shooting.clearFire(); event.preventDefault();
      if (!event.repeat) onMenu(); return;
    }
    if (document.body?.dataset?.menuOpen === 'true') return;
    const direction = directionButtons[event.key];
    if (direction) { setMode('keyboard'); event.preventDefault(); setDirection(direction, true); }
    if (code === binds.dash || (binds.dash === 'ShiftLeft' && code === 'ShiftRight')) {
      setMode('keyboard'); event.preventDefault(); if (!event.repeat) triggerAction('dash');
    }
    if (code === binds.shield) { setMode('keyboard'); if (!event.repeat) triggerAction('shield'); }
    if (code === binds.ability) { setMode('keyboard'); event.preventDefault(); if (!event.repeat) triggerAction('ability'); }
    if (code === binds.interact) { setMode('keyboard'); if (!event.repeat) triggerAction('interact'); }
    if (event.code === 'Escape') onMenu(false);
  });
  window.addEventListener('keyup', (event) => {
    const direction = directionButtons[event.key];
    if (direction) { setMode('keyboard'); event.preventDefault(); setDirection(direction, false); }
  });

  const isPressed = (pad, index) => !!pad.buttons[index] && (pad.buttons[index].pressed || pad.buttons[index].value > 0.5);
  function updateGamepad() {
    const pad = navigator.getGamepads && Array.from(navigator.getGamepads()).find((item) => item?.connected);
    if (!pad) {
      padVector = { x: 0, y: 0 }; shooting.updateGamepad(null); return;
    }
    let x = Math.abs(pad.axes[0] || 0) < 0.18 ? 0 : pad.axes[0];
    let y = Math.abs(pad.axes[1] || 0) < 0.18 ? 0 : pad.axes[1];
    const left = isPressed(pad, 14), right = isPressed(pad, 15), up = isPressed(pad, 12), down = isPressed(pad, 13);
    if (left || right) x = Number(right) - Number(left);
    if (up || down) y = Number(down) - Number(up);
    const magnitude = Math.hypot(x, y);
    if (magnitude > 1) { x /= magnitude; y /= magnitude; }
    padVector = { x, y };
    const pressed = Array.from({ length: pad.buttons.length }, (_, index) => isPressed(pad, index));
    const edge = (buttons) => buttons.some((index) => pressed[index] && !previousButtons[index]);
    if (magnitude || pressed.some(Boolean)) setMode('controller');
    shooting.updateGamepad(pad, pressed);
    if (edge([2, 4])) triggerAction('dash');
    if (edge([1, 6])) triggerAction('shield');
    if (edge([7, 10])) triggerAction('ability');
    if (edge([3])) triggerAction('interact');
    if (edge([9, 8])) { shooting.clearFire(); onMenu(); }
    previousButtons = pressed;
  }
  function update() { updateGamepad(); shooting.update(); }
  window.addEventListener('gamepadconnected', () => { previousButtons = []; setMode('controller'); });
  window.addEventListener('gamepaddisconnected', () => {
    previousButtons = []; padVector = { x: 0, y: 0 }; shooting.updateGamepad(null);
    const another = navigator.getGamepads && Array.from(navigator.getGamepads()).some((item) => item?.connected);
    if (!another) setMode(hasTouch ? 'touch' : 'keyboard');
  });
  setMode(mode);

  return {
    update,
    aimVector: () => shooting.aimVector(mode),
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

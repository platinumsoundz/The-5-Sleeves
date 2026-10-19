export function createInputManager({ onAction, onMenu, onMode, audio }) {
  const held = new Set();
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  let mode = hasTouch ? 'touch' : 'keyboard';
  let padVector = { x: 0, y: 0 };
  let previousButtons = [];
  const setMode = (next) => { mode = next; onMode(next); };
  const setDirection = (direction, active) => active ? held.add(direction) : held.delete(direction);
  const triggerAction = (name) => { audio?.unlock(); audio?.play(name); onAction(name); };
  const directionButtons = { ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down', ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right' };

  document.querySelectorAll('.dpad-button').forEach((button) => {
    const direction = button.dataset.direction;
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault(); audio?.unlock(); setMode('touch'); button.setPointerCapture(event.pointerId);
      button.classList.add('active'); setDirection(direction, true);
    });
    const release = () => { button.classList.remove('active'); setDirection(direction, false); };
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('lostpointercapture', release);
  });
  document.querySelectorAll('.action-button').forEach((button) => {
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault(); setMode('touch'); triggerAction(button.dataset.action);
    });
  });

  window.addEventListener('keydown', (event) => {
    if (event.target?.closest?.('input, textarea')) return;
    const direction = directionButtons[event.key];
    if (direction) { setMode('keyboard'); event.preventDefault(); setDirection(direction, true); }
    if (event.code === 'Space') { setMode('keyboard'); event.preventDefault(); if (!event.repeat) triggerAction('attack'); }
    if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') { setMode('keyboard'); event.preventDefault(); if (!event.repeat) triggerAction('dash'); }
    if (event.code === 'KeyE') { setMode('keyboard'); if (!event.repeat) triggerAction('shield'); }
    if (event.code === 'KeyC') { setMode('keyboard'); if (!event.repeat) onMenu(); }
    if (event.code === 'Escape') onMenu(false);
  });
  window.addEventListener('keyup', (event) => {
    const direction = directionButtons[event.key];
    if (direction) { setMode('keyboard'); event.preventDefault(); setDirection(direction, false); }
  });

  const isPressed = (pad, index) => !!pad.buttons[index] && (pad.buttons[index].pressed || pad.buttons[index].value > 0.5);
  function updateGamepad() {
    if (!navigator.getGamepads) return;
    const pad = Array.from(navigator.getGamepads()).find((item) => item?.connected);
    if (!pad) { padVector = { x: 0, y: 0 }; return; }
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
    if (edge([0, 5])) triggerAction('attack');
    if (edge([2, 4])) triggerAction('dash');
    if (edge([1, 6])) triggerAction('shield');
    if (edge([9, 8, 3])) onMenu();
    previousButtons = pressed;
  }
  window.addEventListener('gamepadconnected', () => { previousButtons = []; setMode('controller'); });
  window.addEventListener('gamepaddisconnected', () => {
    previousButtons = []; padVector = { x: 0, y: 0 };
    const another = navigator.getGamepads && Array.from(navigator.getGamepads()).some((item) => item?.connected);
    if (!another) setMode(hasTouch ? 'touch' : 'keyboard');
  });
  setMode(mode);

  return {
    update: updateGamepad,
    vector() {
      if (mode === 'controller') return { ...padVector };
      let x = Number(held.has('right')) - Number(held.has('left'));
      let y = Number(held.has('down')) - Number(held.has('up'));
      const length = Math.hypot(x, y);
      if (length > 1) { x /= length; y /= length; }
      return { x, y };
    }
  };
}

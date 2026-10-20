export const GAMEPAD_BUTTONS = Object.freeze({
  a: 0, b: 1, x: 2, y: 3, leftBumper: 4, rightBumper: 5,
  leftTrigger: 6, rightTrigger: 7, select: 8, start: 9,
  leftStick: 10, rightStick: 11, up: 12, down: 13, left: 14, right: 15
});

export const GAMEPAD_ACTION_BUTTONS = Object.freeze({
  attack: GAMEPAD_BUTTONS.rightTrigger,
  interact: GAMEPAD_BUTTONS.a,
  dash: GAMEPAD_BUTTONS.b,
  shield: GAMEPAD_BUTTONS.y,
  ability: Object.freeze([GAMEPAD_BUTTONS.x, GAMEPAD_BUTTONS.rightBumper]),
  confirm: GAMEPAD_BUTTONS.a,
  back: GAMEPAD_BUTTONS.b,
  menu: Object.freeze([GAMEPAD_BUTTONS.start, GAMEPAD_BUTTONS.select])
});

const OVERLAYS = '#title-screen, #character-menu, #shop-panel, #arena-panel, #party-invite-toast, #chat-actions, #chat-panel, [role="dialog"][aria-modal="true"]';
const FOCUSABLE = 'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])';

function pressed(pad, index) {
  const button = pad?.buttons?.[index];
  return !!button && (button.pressed || button.value > 0.5);
}

export function gamepadMenuDirection(pad) {
  let x = Math.abs(pad?.axes?.[0] || 0) >= 0.55 ? pad.axes[0] : 0;
  let y = Math.abs(pad?.axes?.[1] || 0) >= 0.55 ? pad.axes[1] : 0;
  const horizontal = Number(pressed(pad, GAMEPAD_BUTTONS.right)) - Number(pressed(pad, GAMEPAD_BUTTONS.left));
  const vertical = Number(pressed(pad, GAMEPAD_BUTTONS.down)) - Number(pressed(pad, GAMEPAD_BUTTONS.up));
  if (horizontal) x = horizontal;
  if (vertical) y = vertical;
  if (Math.max(Math.abs(x), Math.abs(y)) < 0.55) return null;
  if (Math.abs(x) > Math.abs(y)) return x > 0 ? 'right' : 'left';
  return y > 0 ? 'down' : 'up';
}

export function nextFocusIndex(currentIndex, count, direction) {
  if (count < 1) return -1;
  const forward = direction === 'down' || direction === 'right';
  if (currentIndex < 0) return forward ? 0 : count - 1;
  return (currentIndex + (forward ? 1 : count - 1)) % count;
}

function visible(element) {
  if (!element || element.closest('.hidden') || element.hasAttribute('hidden')) return false;
  const style = getComputedStyle(element);
  return style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0;
}

function effectiveZIndex(element) {
  let top = 0;
  for (let node = element; node && node !== document.body; node = node.parentElement) {
    top = Math.max(top, Number.parseInt(getComputedStyle(node).zIndex, 10) || 0);
  }
  return top;
}

export function activeUiOverlay() {
  const overlays = Array.from(document.querySelectorAll(OVERLAYS)).filter(visible);
  return overlays.reduce((top, element) => {
    if (!top) return element;
    const z = effectiveZIndex(element), topZ = effectiveZIndex(top);
    return z >= topZ ? element : top;
  }, null);
}

export function uiBlocksGameplay() {
  return document.body?.dataset?.menuOpen === 'true' || !!activeUiOverlay();
}

export function focusMenuItem(direction) {
  const scope = activeUiOverlay();
  if (!scope) return false;
  const items = Array.from(scope.querySelectorAll(FOCUSABLE)).filter(visible);
  if (!items.length) return false;
  const index = nextFocusIndex(items.indexOf(document.activeElement), items.length, direction);
  items[index].focus();
  return true;
}

export function activateFocusedMenuItem() {
  const scope = activeUiOverlay();
  if (!scope) return false;
  const items = Array.from(scope.querySelectorAll(FOCUSABLE)).filter(visible);
  if (!items.length) return false;
  let target = items.includes(document.activeElement)
    ? document.activeElement
    : (items.find((item) => !item.hasAttribute('data-gamepad-back')) || items[0]);
  target.focus();
  target.click();
  return true;
}

export function dispatchUiBack() {
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true }));
}

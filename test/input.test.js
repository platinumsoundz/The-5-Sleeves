import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inputModeForPointer, stickVector } from '../public/src/inputManager.js';
import { GAMEPAD_ACTION_BUTTONS, GAMEPAD_BUTTONS, gamepadMenuDirection, nextFocusIndex } from '../public/src/controllerNavigation.js';

const close = (a, b) => Math.abs(a - b) < 1e-9;

test('touch pointer activity switches to touch controls even after desktop-mode startup', () => {
  assert.equal(inputModeForPointer('touch'), 'touch');
  assert.equal(inputModeForPointer('mouse'), null);
  assert.equal(inputModeForPointer('pen'), null);
  const source = readFileSync(new URL('../public/src/inputManager.js', import.meta.url), 'utf8');
  assert.match(source, /addEventListener\('pointerdown'/);
  assert.match(source, /addEventListener\('touchstart'/);
});

test('the analog stick covers all 360 degrees, including diagonals', () => {
  const angles = [0, 30, 45, 90, 135, 180, 225, 270, 315];
  for (const degrees of angles) {
    const radians = degrees * Math.PI / 180;
    const vector = stickVector(Math.cos(radians) * 100, Math.sin(radians) * 100, 50);
    assert.ok(close(Math.hypot(vector.x, vector.y), 1), degrees + '° is full speed');
    assert.ok(close(vector.x, Math.cos(radians)), degrees + '° keeps its x angle');
    assert.ok(close(vector.y, Math.sin(radians)), degrees + '° keeps its y angle');
  }
});

test('a diagonal drag is not rounded to a cardinal direction', () => {
  const vector = stickVector(40, 40, 50);
  assert.ok(vector.x > 0 && vector.y > 0, 'both axes move');
  assert.ok(close(vector.x, vector.y), '45° gives an equal split');
});

test('drag distance scales speed and long drags clamp to full speed', () => {
  const half = stickVector(0, 25, 50);
  assert.ok(close(half.y, 0.5), 'half the radius is half speed');
  const far = stickVector(0, 400, 50);
  assert.ok(close(far.y, 1), 'past the radius is full speed');
  assert.ok(close(far.x, 0));
});

test('the dead zone stops jitter at rest', () => {
  assert.deepEqual(stickVector(2, 3, 50), { x: 0, y: 0 });
  assert.deepEqual(stickVector(0, 0, 50), { x: 0, y: 0 });
});

test('controller gameplay bindings match the requested standard layout', () => {
  assert.deepEqual(GAMEPAD_ACTION_BUTTONS, {
    attack: 7, interact: 0, dash: 1, shield: 3, ability: [2, 5],
    confirm: 0, back: 1, menu: [9, 8]
  });
  assert.equal(GAMEPAD_BUTTONS.rightTrigger, 7);
});

test('left stick and D-pad navigate focus in all four directions', () => {
  const buttons = Array.from({ length: 16 }, () => ({ pressed: false, value: 0 }));
  assert.equal(gamepadMenuDirection({ axes: [0, -0.8], buttons }), 'up');
  assert.equal(gamepadMenuDirection({ axes: [0.8, 0], buttons }), 'right');
  buttons[GAMEPAD_BUTTONS.left].pressed = true;
  assert.equal(gamepadMenuDirection({ axes: [0, 0], buttons }), 'left');
  buttons[GAMEPAD_BUTTONS.left].pressed = false;
  buttons[GAMEPAD_BUTTONS.down].pressed = true;
  assert.equal(gamepadMenuDirection({ axes: [0, 0], buttons }), 'down');
  assert.equal(gamepadMenuDirection({ axes: [0.2, 0.2], buttons: [] }), null);
});

test('controller menu focus wraps and starts at the directional edge', () => {
  assert.equal(nextFocusIndex(-1, 4, 'down'), 0);
  assert.equal(nextFocusIndex(-1, 4, 'left'), 3);
  assert.equal(nextFocusIndex(3, 4, 'right'), 0);
  assert.equal(nextFocusIndex(0, 4, 'up'), 3);
  assert.equal(nextFocusIndex(0, 0, 'down'), -1);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { createCamera, updateCamera, zoomForViewport, screenToWorld, visibleWorldBounds, cameraBounds, setZoomScale } from '../public/src/camera.js';

const WORLD = { width: 1000, height: 700 };

test('zoom scales with viewport size', () => {
  const camera = createCamera();
  const desktop = zoomForViewport(camera, 1280, 720);
  const phone = zoomForViewport(camera, 390, 844);
  assert.ok(desktop > 1.5 && desktop < 2.5, 'desktop zoom should sit close to the action');
  assert.ok(phone >= 1, 'phone zoom should never drop below 1x');
  assert.ok(desktop > phone - 1);
});

test('zoom scale is user adjustable within limits', () => {
  const camera = createCamera();
  setZoomScale(camera, 5);
  assert.equal(camera.zoomScale, 1.8);
  setZoomScale(camera, 0);
  assert.equal(camera.zoomScale, 0.65);
});

test('camera follows the target and clamps inside the world', () => {
  const camera = createCamera();
  updateCamera(camera, { x: 500, y: 350 }, WORLD, 1280, 720, 16);
  assert.equal(camera.initialised, true);
  assert.equal(camera.x, 500);
  assert.equal(camera.y, 350);

  for (let i = 0; i < 400; i += 1) updateCamera(camera, { x: 0, y: 0 }, WORLD, 1280, 720, 32 + i * 16);
  const bounds = cameraBounds(camera, WORLD, 1280, 720);
  assert.ok(camera.x >= bounds.minX - 1e-6, 'camera must not travel past the left wall');
  assert.ok(camera.y >= bounds.minY - 1e-6, 'camera must not travel past the top wall');
  assert.ok(camera.x > 1, 'camera should stop at the viewport edge, not the world edge');
});

test('screenToWorld inverts the camera transform', () => {
  const camera = createCamera();
  updateCamera(camera, { x: 420, y: 260 }, WORLD, 800, 600, 16);
  for (let i = 0; i < 60; i += 1) updateCamera(camera, { x: 420, y: 260 }, WORLD, 800, 600, 32 + i * 16);
  camera.offsetX = 0; camera.offsetY = 0;
  const centre = screenToWorld(camera, 400, 300, 800, 600);
  assert.ok(Math.abs(centre.x - camera.x) < 1e-6);
  assert.ok(Math.abs(centre.y - camera.y) < 1e-6);
  const corner = screenToWorld(camera, 0, 0, 800, 600);
  assert.ok(corner.x < centre.x && corner.y < centre.y);
});

test('visible bounds stay inside the world', () => {
  const camera = createCamera();
  updateCamera(camera, { x: 20, y: 20 }, WORLD, 1280, 720, 16);
  for (let i = 0; i < 200; i += 1) updateCamera(camera, { x: 20, y: 20 }, WORLD, 1280, 720, 32 + i * 16);
  const view = visibleWorldBounds(camera, 1280, 720, WORLD);
  assert.ok(view.left >= 0 && view.top >= 0);
  assert.ok(view.right <= WORLD.width && view.bottom <= WORLD.height);
  assert.ok(view.right > view.left && view.bottom > view.top);
});

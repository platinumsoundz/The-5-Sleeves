import { WORLD_DEFAULT } from './config.js';

// Minimum world-space region the viewport should reveal, which drives the
// zoom level. Smaller numbers mean the camera sits closer to the action.
export const VIEW_TARGET = Object.freeze({ width: 660, height: 430 });
const ZOOM_SMOOTHING = 4;
const FOLLOW_SMOOTHING = 9;
const SHAKE_DECAY = 26;
const MAX_SHAKE = 22;
const LOOK_AHEAD_SCALE = 0.22;
const MAX_LOOK_AHEAD = 58;

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

export function createCamera() {
  return {
    x: WORLD_DEFAULT.width / 2,
    y: WORLD_DEFAULT.height / 2,
    zoom: 1,
    zoomScale: 1,
    minZoom: 1,
    maxZoom: 3.6,
    shake: 0,
    offsetX: 0,
    offsetY: 0,
    lookAhead: { x: 0, y: 0 },
    velocity: { x: 0, y: 0 },
    lastTarget: null,
    initialised: false,
    lastTime: 0
  };
}

export function addShake(camera, amount) {
  if (!camera) return;
  camera.shake = Math.min(MAX_SHAKE, camera.shake + amount);
}

export function zoomForViewport(camera, viewWidth, viewHeight) {
  const raw = Math.min(viewWidth / VIEW_TARGET.width, viewHeight / VIEW_TARGET.height) * camera.zoomScale;
  return clamp(raw, camera.minZoom, camera.maxZoom);
}

export function setZoomScale(camera, scale) {
  if (!camera) return camera?.zoomScale;
  camera.zoomScale = clamp(scale, 0.65, 1.8);
  return camera.zoomScale;
}

// Keeps the camera inside the world when the viewport is smaller than the map,
// and centres it when the map fits entirely on screen.
export function cameraBounds(camera, world, viewWidth, viewHeight) {
  const halfWidth = viewWidth / (2 * camera.zoom);
  const halfHeight = viewHeight / (2 * camera.zoom);
  return {
    halfWidth,
    halfHeight,
    minX: world.width <= halfWidth * 2 ? world.width / 2 : halfWidth,
    maxX: world.width <= halfWidth * 2 ? world.width / 2 : world.width - halfWidth,
    minY: world.height <= halfHeight * 2 ? world.height / 2 : halfHeight,
    maxY: world.height <= halfHeight * 2 ? world.height / 2 : world.height - halfHeight
  };
}

export function updateCamera(camera, target, world, viewWidth, viewHeight, time) {
  if (!camera) return;
  const dt = camera.lastTime ? Math.min((time - camera.lastTime) / 1000, 0.1) : 0;
  camera.lastTime = time;

  const targetZoom = zoomForViewport(camera, viewWidth, viewHeight);
  camera.zoom = camera.initialised ? camera.zoom + (targetZoom - camera.zoom) * Math.min(1, dt * ZOOM_SMOOTHING) : targetZoom;

  if (target) {
    // Smooth the target's measured velocity so the look-ahead drifts instead of snapping.
    const previous = camera.lastTarget || target;
    const instantVx = dt > 0 ? clamp((target.x - previous.x) / dt, -500, 500) : 0;
    const instantVy = dt > 0 ? clamp((target.y - previous.y) / dt, -500, 500) : 0;
    camera.lastTarget = { x: target.x, y: target.y };
    camera.velocity.x += (instantVx - camera.velocity.x) * Math.min(1, dt * 6);
    camera.velocity.y += (instantVy - camera.velocity.y) * Math.min(1, dt * 6);
    camera.lookAhead.x = clamp(camera.velocity.x * LOOK_AHEAD_SCALE, -MAX_LOOK_AHEAD, MAX_LOOK_AHEAD);
    camera.lookAhead.y = clamp(camera.velocity.y * LOOK_AHEAD_SCALE, -MAX_LOOK_AHEAD, MAX_LOOK_AHEAD);
  } else {
    camera.lastTarget = null;
    camera.lookAhead.x = 0; camera.lookAhead.y = 0;
  }

  const desiredX = (target ? target.x : world.width / 2) + camera.lookAhead.x;
  const desiredY = (target ? target.y : world.height / 2) + camera.lookAhead.y;

  if (camera.initialised) {
    const k = 1 - Math.exp(-dt * FOLLOW_SMOOTHING);
    camera.x += (desiredX - camera.x) * k;
    camera.y += (desiredY - camera.y) * k;
  } else {
    camera.x = desiredX; camera.y = desiredY; camera.initialised = true;
  }

  const bounds = cameraBounds(camera, world, viewWidth, viewHeight);
  camera.x = clamp(camera.x, bounds.minX, bounds.maxX);
  camera.y = clamp(camera.y, bounds.minY, bounds.maxY);

  if (camera.shake > 0.05) {
    camera.shake = Math.max(0, camera.shake - dt * SHAKE_DECAY);
    camera.offsetX = (Math.random() * 2 - 1) * camera.shake;
    camera.offsetY = (Math.random() * 2 - 1) * camera.shake;
  } else {
    camera.shake = 0; camera.offsetX = 0; camera.offsetY = 0;
  }
}

export function applyCamera(ctx, camera, viewWidth, viewHeight) {
  ctx.translate(viewWidth / 2, viewHeight / 2);
  ctx.scale(camera.zoom, camera.zoom);
  ctx.translate(-camera.x + camera.offsetX, -camera.y + camera.offsetY);
}

export function visibleWorldBounds(camera, viewWidth, viewHeight, world) {
  const halfWidth = viewWidth / (2 * camera.zoom);
  const halfHeight = viewHeight / (2 * camera.zoom);
  const bounds = {
    left: camera.x - camera.offsetX - halfWidth,
    top: camera.y - camera.offsetY - halfHeight,
    right: camera.x - camera.offsetX + halfWidth,
    bottom: camera.y - camera.offsetY + halfHeight
  };
  if (world) {
    bounds.left = Math.max(0, bounds.left);
    bounds.top = Math.max(0, bounds.top);
    bounds.right = Math.min(world.width, bounds.right);
    bounds.bottom = Math.min(world.height, bounds.bottom);
  }
  return bounds;
}

export function screenToWorld(camera, screenX, screenY, viewWidth, viewHeight) {
  return {
    x: (screenX - viewWidth / 2) / camera.zoom + camera.x - camera.offsetX,
    y: (screenY - viewHeight / 2) / camera.zoom + camera.y - camera.offsetY
  };
}

export function isVisible(bounds, x, y, padding = 0) {
  return x >= bounds.left - padding && x <= bounds.right + padding && y >= bounds.top - padding && y <= bounds.bottom + padding;
}

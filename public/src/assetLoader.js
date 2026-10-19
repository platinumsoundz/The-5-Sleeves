const cache = new Map();

export function optionalImage(path) {
  if (cache.has(path)) return cache.get(path);
  const image = new Image();
  image.loaded = false;
  image.onload = () => { image.loaded = true; };
  image.onerror = () => { image.loaded = false; };
  image.src = path;
  cache.set(path, image);
  return image;
}

export function drawSpriteOrProcedural(ctx, image, drawProcedural, x, y, width, height) {
  if (image?.loaded && image.naturalWidth > 0) {
    ctx.drawImage(image, x, y, width, height);
    return true;
  }
  drawProcedural(ctx, x, y, width, height);
  return false;
}

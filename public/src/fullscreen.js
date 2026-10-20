// Fullscreen API access is called only from a user gesture in Settings.
export function fullscreenActive(doc = globalThis.document) {
  return !!doc?.fullscreenElement;
}

export async function toggleFullscreen(doc = globalThis.document) {
  if (!doc) return false;
  try {
    if (doc.fullscreenElement) {
      if (typeof doc.exitFullscreen !== 'function') return false;
      await doc.exitFullscreen();
      return true;
    }
    const root = doc.documentElement;
    if (typeof root?.requestFullscreen !== 'function') return false;
    await root.requestFullscreen();
    return true;
  } catch (_) {
    // Browsers can reject fullscreen when permissions or platform policy block it.
    return false;
  }
}

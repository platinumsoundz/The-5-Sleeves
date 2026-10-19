// Boots the plug-and-play client modules listed by the server. Each module
// lives in public/src/modules/<name>.js, exports default
// { name, summary, priority?, setup(ctx) } and is loaded fail-soft: a broken
// module logs and is skipped. See memory/03-module-architecture.md.
//
// Boot is fast by design: every module is import()ed in parallel, then set
// up in priority order (lower number first, default 50) while progress is
// reported to the loading screen.
import { bus } from './plugin-host.js';

const DEFAULT_PRIORITY = 50;

// Small DOM helper for module UI: a fixed-position layer above the game.
export function moduleDom(styleText) {
  let root = document.getElementById('module-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'module-root';
    document.body.appendChild(root);
  }
  const layer = document.createElement('div');
  layer.style.cssText = 'position:fixed;' + (styleText || '');
  root.appendChild(layer);
  return layer;
}

// onProgress(done, total, name) feeds the loading screen on the title page.
export async function loadClientModules(context, onProgress = () => {}) {
  let names = [];
  try {
    const response = await fetch('/api/client-modules');
    names = (await response.json()).modules || [];
  } catch (error) {
    console.error('[modules] manifest fetch failed: ' + error.message);
    return [];
  }
  if (!names.length) return [];

  // 1) Import everything in parallel — the browser does the fetching.
  const imports = await Promise.allSettled(names.map((name) => import('./modules/' + name + '.js')));

  // 2) Set up in boot-priority order so early modules (state, atmosphere)
  //    are ready before late ones (cosmetics) that may rely on them.
  const ready = [];
  const bootable = [];
  imports.forEach((result, index) => {
    if (result.status === 'rejected') {
      console.error('[module] ' + names[index] + ' failed to import: ' + result.reason);
      return;
    }
    const module = result.value.default;
    if (!module || typeof module.setup !== 'function') {
      console.error('[module] ' + names[index] + ' has no default export with setup(ctx)');
      return;
    }
    bootable.push({ name: names[index], module });
  });
  bootable.sort((a, b) => (a.module.priority ?? DEFAULT_PRIORITY) - (b.module.priority ?? DEFAULT_PRIORITY) || a.name.localeCompare(b.name));

  onProgress(0, bootable.length, '');
  for (const { name, module } of bootable) {
    try {
      module.setup({ ...context, bus, on: bus.on, emit: bus.emit, dom: moduleDom });
      ready.push(name);
      console.log('[module] ' + name + ' ready — ' + (module.summary || ''));
    } catch (error) {
      console.error('[module] ' + name + ' failed to set up: ' + error.message);
    }
    onProgress(ready.length, bootable.length, name);
  }
  return ready;
}

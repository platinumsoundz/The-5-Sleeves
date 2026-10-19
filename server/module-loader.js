// The module master: scans a folder of small plug-and-play modules and boots
// each one with the shared context. Modules may declare `priority` (lower
// number boots first, default 50) so boot order is deterministic and
// optimisable. A module that throws is logged and skipped — one broken
// feature must never crash the game server.
// See memory/03-module-architecture.md for the module contract.
const fs = require('fs');
const path = require('path');

const DEFAULT_PRIORITY = 50;

function loadModules(directory, context) {
  const loaded = [];
  let entries = [];
  try {
    entries = fs.readdirSync(directory);
  } catch (_) {
    return loaded;
  }

  // Require first (cheap), then boot in priority order.
  const bootable = [];
  for (const file of entries) {
    if (!file.endsWith('.js')) continue;
    try {
      const module = require(path.join(directory, file));
      if (!module || typeof module.setup !== 'function') throw new Error('missing setup(ctx)');
      bootable.push({ module, file });
    } catch (error) {
      console.error('[module] ' + file + ' failed to load: ' + error.message);
    }
  }
  bootable.sort((a, b) => (a.module.priority ?? DEFAULT_PRIORITY) - (b.module.priority ?? DEFAULT_PRIORITY) || a.file.localeCompare(b.file));

  for (const { module, file } of bootable) {
    try {
      module.setup(context);
      loaded.push(module.name || file);
      console.log('[module] loaded ' + (module.name || file) + ' — ' + (module.summary || 'no summary'));
    } catch (error) {
      console.error('[module] ' + file + ' failed to set up: ' + error.message);
    }
  }
  if (loaded.length) console.log('[modules] ' + loaded.length + ' active: ' + loaded.join(', '));
  return loaded;
}

module.exports = { loadModules, DEFAULT_PRIORITY };

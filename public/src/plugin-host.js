// The client-side hook bus: how plug-and-play modules listen to the game
// without client.js / renderer.js knowing who they are. DOM-free so tests
// can import it in Node. See memory/03-module-architecture.md.
export function createHookBus() {
  const listeners = new Map();
  return {
    on(event, handler) {
      if (!listeners.has(event)) listeners.set(event, []);
      listeners.get(event).push(handler);
    },
    emit(event, ...args) {
      for (const handler of listeners.get(event) || []) {
        try {
          handler(...args);
        } catch (error) {
          console.error('[hook ' + event + '] ' + error.message);
        }
      }
    }
  };
}

// Shared singleton — the renderer, client.js and every module use this one.
export const bus = createHookBus();

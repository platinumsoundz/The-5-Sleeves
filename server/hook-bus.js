// Tiny event bus for the plug-and-play module system. One job: let modules
// subscribe to server events without the master knowing who they are.
// Handlers that throw are logged and skipped so one bad module cannot take
// the server down.
function createHookBus() {
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

module.exports = { createHookBus };

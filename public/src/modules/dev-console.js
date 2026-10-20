// The server decides whether this development-only Settings panel is available.
export default {
  name: 'dev-console',
  summary: 'Token-gated test grants in Settings on explicitly enabled dev servers.',
  priority: 70,
  setup(ctx) {
    const socket = ctx.state.socket;
    if (!socket || typeof fetch !== 'function' || typeof MutationObserver !== 'function') return;

    fetch('/api/dev-console/status').then((response) => response.json()).then(({ enabled }) => {
      if (!enabled) return;
      const attach = () => {
        const root = document.querySelector('[data-menu-content="settings"]');
        if (!root || root.querySelector('[data-dev-console]')) return;
        const panel = document.createElement('section');
        panel.dataset.devConsole = 'true';
        const heading = document.createElement('h3');
        heading.className = 'menu-section-title';
        heading.textContent = 'DEVELOPER TOOLS';
        const note = document.createElement('p');
        note.className = 'menu-empty';
        note.textContent = 'Development server only. Enter the server-provided token to unlock test grants.';
        const token = document.createElement('input');
        token.type = 'password';
        token.autocomplete = 'off';
        token.placeholder = 'Developer token';
        token.setAttribute('aria-label', 'Developer token');
        const status = document.createElement('p');
        status.className = 'menu-empty';
        const unlock = document.createElement('button');
        unlock.type = 'button';
        unlock.className = 'menu-action';
        unlock.textContent = 'UNLOCK';
        const grant = document.createElement('button');
        grant.type = 'button';
        grant.className = 'menu-action danger';
        grant.textContent = 'GRANT TEST LOADOUT';
        grant.hidden = true;
        unlock.addEventListener('click', () => socket.emit('dev:authorize', { token: token.value }));
        grant.addEventListener('click', () => socket.emit('dev:grant', { grant: 'all' }));
        panel.append(heading, note, token, unlock, grant, status);
        root.append(panel);

        socket.on('dev:authorized', (message) => {
          token.value = '';
          token.disabled = true;
          unlock.hidden = true;
          grant.hidden = false;
          status.textContent = message;
        });
        socket.on('dev:error', (message) => { status.textContent = message; });
        socket.on('dev:granted', (result) => {
          status.textContent = 'Granted ' + result.credits + ' credits, ' + result.skillPoints + ' skill points, and ' + result.items + ' items.';
        });
      };
      attach();
      new MutationObserver(attach).observe(document.body, { childList: true, subtree: true });
    }).catch(() => {});
  }
};

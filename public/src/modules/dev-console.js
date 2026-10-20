// Server config gates this development-only Settings panel and validates codes.
export default {
  name: 'dev-console',
  summary: 'Redeem server-configured test-grant codes in Settings.',
  priority: 70,
  setup(ctx) {
    const socket = ctx.state.socket;
    if (!socket || typeof fetch !== 'function' || typeof MutationObserver !== 'function') return;

    let statusElement = null;
    socket.on('dev:error', (message) => { if (statusElement) statusElement.textContent = message; });
    socket.on('dev:redeemed', (result) => {
      if (statusElement) statusElement.textContent = 'Code applied: ' + result.grant.toUpperCase() + ' · ' + result.credits + ' credits · ' + result.skillPoints + ' skill points · ' + result.items + ' items.';
    });

    fetch('/api/dev-console/status').then((response) => response.json()).then(({ enabled }) => {
      if (!enabled) return;
      const attach = () => {
        const root = document.querySelector('[data-menu-content="settings"]');
        if (!root || root.querySelector('[data-dev-console]')) return;
        const panel = document.createElement('section');
        panel.dataset.devConsole = 'true';
        const heading = document.createElement('h3');
        heading.className = 'menu-section-title';
        heading.textContent = 'DEVELOPER TEST CODES';
        const note = document.createElement('p');
        note.className = 'menu-empty';
        note.textContent = 'Enabled only on explicitly configured non-production servers. Enter a server-issued code to grant test resources.';
        const input = document.createElement('input');
        input.type = 'password';
        input.autocomplete = 'off';
        input.placeholder = 'Enter grant code';
        input.setAttribute('aria-label', 'Developer grant code');
        const redeem = document.createElement('button');
        redeem.type = 'button';
        redeem.className = 'menu-action';
        redeem.textContent = 'REDEEM CODE';
        const status = document.createElement('p');
        status.className = 'menu-empty';
        redeem.addEventListener('click', () => {
          socket.emit('dev:redeem', { code: input.value });
          input.value = '';
        });
        panel.append(heading, note, input, redeem, status);
        root.append(panel);
        statusElement = status;
      };
      attach();
      new MutationObserver(attach).observe(document.body, { childList: true, subtree: true });
    }).catch(() => {});
  }
};

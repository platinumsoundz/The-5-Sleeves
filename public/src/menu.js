// Multi-page MENU controller. Tabs switch between Character, Skill Tree,
// Inventory, Party & Friends, Inbox, Map and Settings. Page builders live in
// menu-pages.js so this file only owns navigation and open/close state.
import {
  renderCharacterPage, renderInboxPage, renderInventoryPage,
  renderMapPage, renderPartyPage, renderSettingsPage, renderSkillsPage
} from './menu-pages.js';

const PAGE_RENDERERS = {
  character: renderCharacterPage,
  skills: renderSkillsPage,
  inventory: renderInventoryPage,
  party: renderPartyPage,
  inbox: renderInboxPage,
  map: renderMapPage,
  settings: renderSettingsPage
};

export function createMenu({ actions, getState, getPlayer }) {
  const root = document.querySelector('#character-menu');
  const tabs = Array.from(document.querySelectorAll('#menu-tabs [data-menu-page]'));
  const pages = Array.from(document.querySelectorAll('[data-menu-content]'));
  let current = 'character';

  function refresh() {
    if (!root) return;
    const player = getPlayer?.() || null;
    const state = getState?.() || {};
    const points = root.querySelector('#skill-points');
    if (points) points.textContent = 'Level ' + (player?.level || 1) + ' · Skill Points: ' + (player?.skillPoints || 0) + ' · ' + (state.zone?.name || 'The Perimeter');
    for (const page of pages) page.classList.toggle('hidden', page.dataset.menuContent !== current);
    for (const tab of tabs) {
      const selected = tab.dataset.menuPage === current;
      tab.classList.toggle('selected', selected);
      tab.setAttribute('aria-selected', String(selected));
    }
    const target = pages.find((page) => page.dataset.menuContent === current);
    const renderer = PAGE_RENDERERS[current];
    if (target && renderer) renderer(target, { player, state, actions, refresh, close });
  }

  function open(forceOpen) {
    if (!root) return;
    const openNow = typeof forceOpen === 'boolean' ? forceOpen : root.classList.contains('hidden');
    root.classList.toggle('hidden', !openNow);
    if (openNow) {
      document.body.dataset.menuOpen = 'true';
      refresh();
    } else {
      delete document.body.dataset.menuOpen;
    }
  }

  function close() { open(false); }
  function toggle(forceOpen) { open(forceOpen); }
  function showPage(page) {
    if (PAGE_RENDERERS[page]) current = page;
    refresh();
  }

  for (const tab of tabs) {
    tab.addEventListener('click', () => { current = tab.dataset.menuPage; refresh(); });
  }
  root?.querySelector('#menu-close')?.addEventListener('click', close);
  root?.addEventListener('click', (event) => { if (event.target === root) close(); });

  return {
    refresh, open, close, toggle, showPage,
    get page() { return current; },
    isOpen: () => !!root && !root.classList.contains('hidden')
  };
}

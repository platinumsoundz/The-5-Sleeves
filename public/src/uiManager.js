import { PROFILE_KEY } from './config.js';

export function createUIManager(actions) {
  const $ = (selector) => document.querySelector(selector);
  const title = $('#title-screen');
  const form = $('#join-form');
  const nameInput = $('#username-input');
  const enterButton = $('#enter-button');
  const nameError = $('#name-error');
  const menu = $('#character-menu');
  const hints = $('#control-hints');
  const status = $('#status');
  const archiveToast = $('#archive-toast');
  let toastTimer = null;
  let joined = false;
  let profile = {};
  try { profile = JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}') || {}; } catch (_) { profile = {}; }
  let profileSnapshot = JSON.stringify(profile);
  if (typeof profile.name === 'string') nameInput.value = profile.name;

  function saveProfile() {
    const serialized = JSON.stringify(profile);
    if (serialized === profileSnapshot) return;
    try { localStorage.setItem(PROFILE_KEY, serialized); profileSnapshot = serialized; } catch (_) {}
  }
  function updateMenu(player) {
    if (!player) return;
    $('#skill-points').textContent = 'Skill Points: ' + (player.skillPoints || 0);
    $('#atk-level').textContent = 'Lv ' + (player.atk || 0);
    $('#plating-level').textContent = 'Lv ' + (player.plating || 0);
    $('#overclock-level').textContent = 'Lv ' + (player.overclock || 0);
    document.querySelectorAll('.upgrade-button').forEach((button) => {
      button.disabled = !joined || (player.skillPoints || 0) <= 0 || (player[button.dataset.upgrade] || 0) >= 99;
    });
    document.querySelectorAll('.color-option').forEach((button) => {
      button.classList.toggle('selected', button.dataset.color === player.energyColor);
    });
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const name = nameInput.value.trim();
    if (!name) { nameError.textContent = 'Enter a character name.'; return; }
    nameError.textContent = '';
    enterButton.disabled = true;
    actions.join(name);
  });
  $('#specs-button').addEventListener('click', () => actions.toggleMenu());
  $('#menu-close').addEventListener('click', () => menu.classList.add('hidden'));
  menu.addEventListener('click', (event) => { if (event.target === menu) menu.classList.add('hidden'); });
  document.querySelectorAll('.upgrade-button').forEach((button) => {
    button.addEventListener('click', () => actions.upgrade(button.dataset.upgrade));
  });
  document.querySelectorAll('.color-option').forEach((button) => {
    button.addEventListener('click', () => actions.selectDomain(button.dataset.color));
  });

  return {
    getSavedName: () => profile.name || '',
    setStatus(message, connected) {
      status.textContent = message;
      status.classList.toggle('offline', !connected);
    },
    joinAccepted({ name, stats }) {
      joined = true;
      profile = { ...profile, name, ...stats };
      saveProfile();
      title.classList.add('hidden');
      enterButton.disabled = false;
      nameError.textContent = '';
      status.textContent = 'Welcome, ' + name;
      updateMenu(profile);
    },
    joinError(message) { nameError.textContent = message; enterButton.disabled = false; },
    showArchiveToast(message) {
      archiveToast.textContent = message;
      archiveToast.classList.add('visible');
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(() => archiveToast.classList.remove('visible'), 5200);
    },
    updatePlayer(player) {
      profile = { name: player.name, hp: player.hp, maxHp: player.maxHp, coreCharge: player.coreCharge, corePoints: player.corePoints, skillPoints: player.skillPoints, atk: player.atk, plating: player.plating, overclock: player.overclock, energyColor: player.energyColor };
      saveProfile();
      updateMenu(player);
    },
    setInputMode(mode) {
      document.body.dataset.inputMode = mode;
      if (mode === 'keyboard') hints.innerHTML = '<span class="control-badge">WASD / ↑↓←→</span> Move &nbsp; <span class="control-badge">SPACE</span> Blast<br /><span class="control-badge">SHIFT</span> Dash &nbsp; <span class="control-badge">E</span> Shield &nbsp; <span class="control-badge">C</span> Specs';
      else if (mode === 'controller') hints.innerHTML = '<span class="control-badge">STICK / D-PAD</span> Move &nbsp; <span class="control-badge">A / R1</span> Blast<br /><span class="control-badge">X / L1</span> Dash &nbsp; <span class="control-badge">B / L2</span> Shield &nbsp; <span class="control-badge">START / SELECT / Y</span> Specs';
      else hints.textContent = '';
    },
    toggleMenu(forceOpen) {
      if (!joined) return;
      const open = typeof forceOpen === 'boolean' ? forceOpen : menu.classList.contains('hidden');
      if (open) updateMenu(actions.getPlayer?.());
      menu.classList.toggle('hidden', !open);
    }
  };
}

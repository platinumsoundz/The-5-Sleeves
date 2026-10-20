// Player-remappable action keys. Movement stays on WASD/arrows so the analog
// stick and keyboard feel identical; only combat/UI actions are configurable.
export const DEFAULT_KEYBINDS = Object.freeze({
  attack: 'Space',
  dash: 'ShiftLeft',
  shield: 'KeyE',
  ability: 'KeyQ',
  interact: 'KeyF',
  menu: 'KeyC'
});
export const KEYBIND_ACTIONS = Object.freeze([
  { id: 'attack', label: 'Energy Blast' },
  { id: 'dash', label: 'Dash' },
  { id: 'shield', label: 'Shield' },
  { id: 'ability', label: 'Sleeve Ability' },
  { id: 'interact', label: 'Interact / Read' },
  { id: 'menu', label: 'Open Menu' }
]);
const STORAGE_KEY = 'the5sleeves.keybinds.v1';

export function loadKeybinds() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return { ...DEFAULT_KEYBINDS, ...(stored && typeof stored === 'object' ? stored : {}) };
  } catch (_) {
    return { ...DEFAULT_KEYBINDS };
  }
}

export function saveKeybinds(bindings) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(bindings)); } catch (_) {}
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent('keybinds:changed'));
  }
}

// Human-readable key label for the settings page and HUD hints.
export function keyLabel(code) {
  if (!code) return '—';
  if (code === 'Space') return 'SPACE';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code === 'ShiftLeft' || code === 'ShiftRight') return 'SHIFT';
  if (code === 'ControlLeft' || code === 'ControlRight') return 'CTRL';
  if (code === 'AltLeft' || code === 'AltRight') return 'ALT';
  if (code === 'ArrowUp') return '↑';
  if (code === 'ArrowDown') return '↓';
  if (code === 'ArrowLeft') return '←';
  if (code === 'ArrowRight') return '→';
  return code.replace(/Key|Digit/, '').toUpperCase();
}

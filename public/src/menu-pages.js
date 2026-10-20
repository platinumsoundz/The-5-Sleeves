// Renderers for the expanded MENU pages. Pure DOM builders: they read the
// live player/state and call back into the UI actions, so uiManager.js stays a
// thin coordinator. No top-level DOM access (safe to import in tests).
import { DEFAULT_PALETTE, DOMAINS, ITEM_CATALOG, PLAYER_PALETTES, SKILL_TREE, WORLD_DEFAULT } from './config.js';
import { KEYBIND_ACTIONS, keyLabel, loadKeybinds, saveKeybinds } from './keybinds.js';
import { getShootingMode, setShootingMode, SHOOTING_MODE } from './shooting.js';

const SLOTS = [
  ['head', 'HEAD'], ['chest', 'CHEST'], ['legs', 'LEGS'], ['feet', 'FEET'], ['weapon', 'WEAPON']
];
const SLOT_CLASS = { head: 'slot-head', chest: 'slot-chest', legs: 'slot-legs', feet: 'slot-feet', weapon: 'slot-weapon' };
const SLOT_ORDER = Object.fromEntries(SLOTS.map(([slot], index) => [slot, index]));

// Inventory filter survives page refreshes (e.g. after equipping) while the
// menu stays open. Clicking the same doll slot again clears it.
let gearFilter = 'all';

function make(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function svgNode(tag, attributes = {}) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  return node;
}

function section(root, title) {
  const heading = make('h3', 'menu-section-title', title);
  root.append(heading);
  return heading;
}

function empty(root, text) {
  root.append(make('p', 'menu-empty', text));
}

function statChip(label, value, note, color) {
  const chip = make('div', 'spec-chip');
  if (color) chip.style.borderColor = color;
  chip.append(make('small', '', label));
  chip.append(make('strong', '', value));
  if (note) chip.append(make('span', 'spec-note', note));
  return chip;
}

function paperdollFigure() {
  const svg = svgNode('svg', { viewBox: '0 0 100 200', role: 'presentation', 'aria-hidden': 'true' });
  svg.classList.add('paperdoll-figure');
  svg.append(
    svgNode('circle', { cx: 50, cy: 26, r: 13, class: 'doll-head' }),
    svgNode('path', { d: 'M50 39 L50 112', class: 'doll-spine' }),
    svgNode('path', { d: 'M22 64 L50 54 L78 64', class: 'doll-spine' }),
    svgNode('path', { d: 'M22 64 L16 106 M78 64 L84 106', class: 'doll-limb' }),
    svgNode('path', { d: 'M50 112 L34 158 L28 192 M50 112 L66 158 L72 192', class: 'doll-limb' }),
    svgNode('path', { d: 'M50 56 L64 74 L50 94 L36 74 Z', class: 'doll-chest' })
  );
  return svg;
}

function paperdollSlot(slot, label, player, refresh) {
  const item = ITEM_CATALOG[player.equipped?.[slot]];
  const selected = gearFilter === slot;
  const button = make('button', 'paperdoll-slot ' + SLOT_CLASS[slot] + (item ? ' filled' : '') + (selected ? ' selected' : ''));
  button.type = 'button';
  button.setAttribute('aria-pressed', String(selected));
  button.setAttribute('aria-label', label + ': ' + (item ? item.name : 'empty slot'));
  button.append(make('span', 'paperdoll-label', label));
  button.append(make('strong', 'paperdoll-item', item ? item.name : 'EMPTY'));
  button.append(make('small', 'paperdoll-tier', item ? item.tier + (item.atkBonus ? ' · ATK +' + item.atkBonus : ' · UTILITY') : 'No gear'));
  button.addEventListener('click', () => {
    gearFilter = selected ? 'all' : slot;
    refresh?.();
  });
  return button;
}

export function renderCharacterPage(root, { player, actions }) {
  root.replaceChildren();
  if (!player) { empty(root, 'Join the Conduit to inspect your operative.'); return; }
  const domain = DOMAINS[player.energyColor] || DOMAINS.cipher;
  const power = (player.atk || 0) + (player.gearAtk || 0);
  const overclock = player.overclock || 0;

  // Identity card: who you are, which sleeve faction you channel, and how far
  // the current level has progressed. Gear lives on the Inventory page now.
  const identity = make('div', 'operative-card');
  identity.style.setProperty('--domain', domain.primary);
  identity.style.setProperty('--domain-accent', domain.accent);
  const monogram = make('div', 'operative-monogram', (player.name || '?').slice(0, 1).toUpperCase());
  const copy = make('div', 'operative-identity');
  copy.append(make('strong', '', player.name || 'Operative'));
  copy.append(make('span', 'operative-faction', domain.label.toUpperCase()));
  copy.append(make('small', '', 'LEVEL ' + (player.level || 1) + ' · ' + power + ' POWER · ' + (player.energyColor || 'cipher').toUpperCase() + ' CHANNEL'));
  identity.append(monogram, copy);
  root.append(identity);

  const xpInto = Math.max(0, player.xpIntoLevel || 0);
  const xpNeeded = Math.max(1, player.xpNeeded || 120);
  const xp = make('div', 'xp-block');
  const xpLabels = make('div', 'xp-labels');
  xpLabels.append(make('span', '', 'LEVEL ' + (player.level || 1)), make('span', '', xpInto + ' / ' + xpNeeded + ' XP'));
  const xpTrack = make('div', 'xp-track');
  const xpFill = make('div', 'xp-fill');
  xpFill.style.width = Math.min(100, Math.round((xpInto / xpNeeded) * 100)) + '%';
  xpTrack.append(xpFill);
  xp.append(xpLabels, xpTrack);
  root.append(xp);

  section(root, 'STATISTICS');
  const stats = make('div', 'spec-strip');
  stats.append(
    statChip('HEALTH', Math.ceil(player.hp || 0) + ' / ' + (player.maxHp || 0), 'current / maximum', '#8ce0ff'),
    statChip('POWER', String(power), (player.gearAtk ? 'incl. +' + player.gearAtk + ' gear' : 'base ATK'), '#8effe6'),
    statChip('PLATING', 'Lv ' + (player.plating || 0), '+' + ((player.plating || 0) * 15) + ' max HP', '#8ce0ff'),
    statChip('OVERCLOCK', 'Lv ' + overclock, '−' + Math.round((1 - Math.pow(0.9, overclock)) * 100) + '% dash/shield cooldowns', '#c9a6ff'),
    statChip('CORE CHARGE', Math.floor(player.coreCharge || 0) + '%', 'standing in the Core', '#ffe9a0'),
    statChip('SKILL POINTS', String(player.skillPoints || 0), 'spend on the Skill Tree', '#ffd479'),
    statChip('CREDITS', String(player.credits || 0), 'merchant currency', '#ffe9a0'),
    statChip('TOTAL XP', String(player.xp || 0), 'earned lifetime', '#a7ffd0')
  );
  root.append(stats);

  section(root, 'ACTIVE SLEEVE SPECS');
  const specs = make('div', 'spec-strip');
  specs.append(
    statChip('DOMAIN', domain.label, player.energyColor || 'cipher', domain.primary),
    statChip('SIGNATURE ABILITY', player.abilityName || 'Conduit Pulse', 'press Q / RT to cast', domain.accent),
    statChip('RECHARGE', (player.abilityCooldownMax ? (player.abilityCooldownMax / 1000).toFixed(1) : '—') + 's', 'affected by Conduit Attunement', '#8effe6'),
    statChip('FACTION CHANNEL', (player.energyColor || 'cipher').toUpperCase(), 'chat with /f', '#ffd479')
  );
  root.append(specs);

  section(root, 'SLEEVE DOMAIN · FACTION');
  root.append(make('p', 'menu-empty', 'Every domain is a sleeve faction. Your choice sets the signature ability, aura and faction chat channel. Switching is free and takes effect immediately.'));
  const colors = make('div', 'color-options');
  for (const [key, info] of Object.entries(DOMAINS)) {
    const button = make('button', 'color-option domain-option' + (player.energyColor === key ? ' selected' : ''), info.label);
    button.type = 'button';
    button.dataset.color = key;
    button.style.setProperty('--swatch', info.primary);
    button.append(make('small', '', key.toUpperCase() + ' CHANNEL'));
    button.addEventListener('click', () => actions.selectDomain(key));
    colors.append(button);
  }
  root.append(colors);

  section(root, 'SUIT COLOUR');
  root.append(make('p', 'menu-empty', 'Cosmetic only: recolours your scarf, chest strap and aura sparks. Your sleeve faction keeps its own ability colour.'));
  const palette = make('div', 'palette-options');
  const current = player.palette || PLAYER_PALETTES.find((swatch) => swatch.id === DEFAULT_PALETTE)?.hex || PLAYER_PALETTES[0].hex;
  for (const swatch of PLAYER_PALETTES) {
    const selected = current.toLowerCase() === swatch.hex.toLowerCase();
    const button = make('button', 'palette-swatch' + (selected ? ' selected' : ''));
    button.type = 'button';
    button.style.setProperty('--swatch', swatch.hex);
    button.setAttribute('aria-label', swatch.name + ' suit colour');
    button.setAttribute('aria-pressed', String(selected));
    button.append(make('span', 'palette-chip'), make('small', '', swatch.name.toUpperCase()));
    button.addEventListener('click', () => actions.setPalette(swatch.id));
    palette.append(button);
  }
  root.append(palette);
}

export function renderSkillsPage(root, { player, actions }) {
  root.replaceChildren();
  if (!player) { empty(root, 'Join the Conduit to unlock sleeve nodes.'); return; }
  const points = player.skillPoints || 0;
  const skills = player.skills || {};
  const unlocked = SKILL_TREE.filter((node) => skills[node.id]).length;

  // One glance summary; the same pool pays for core upgrades and tree nodes.
  const summary = make('div', 'skill-summary');
  const available = make('div', 'skill-summary-cell');
  available.append(make('strong', '', String(points)), make('small', '', 'POINTS AVAILABLE'));
  const progress = make('div', 'skill-summary-cell');
  progress.append(make('strong', '', unlocked + ' / ' + SKILL_TREE.length), make('small', '', 'NODES UNLOCKED'));
  summary.append(available, progress);
  root.append(summary);
  root.append(make('p', 'menu-empty', 'Points come from levelling up and charging the Core. Core upgrades are permanent stat tiers; tree nodes add new behaviour to your sleeve.'));

  section(root, 'CORE UPGRADES');
  const rows = [
    ['atk', 'Sleeve Power (ATK)', '+3 Energy Blast damage per level'],
    ['plating', 'Conduit Plating (HP)', '+15 maximum health per level'],
    ['overclock', 'Overclock (SPD)', 'Dash and Shield cooldowns −10% per level']
  ];
  for (const [stat, title, note] of rows) {
    const row = make('div', 'skill-row');
    const copy = make('div');
    copy.append(make('strong', '', title));
    copy.append(make('small', '', note));
    const level = make('span', 'skill-level', 'Lv ' + (player[stat] || 0));
    const button = make('button', 'upgrade-button', '+');
    button.type = 'button';
    button.disabled = points <= 0 || (player[stat] || 0) >= 99;
    button.title = points <= 0 ? 'Earn a skill point first' : 'Spend 1 skill point';
    button.addEventListener('click', () => actions.upgrade(stat));
    row.append(copy, level, button);
    root.append(row);
  }

  section(root, 'SLEEVE SKILL TREE');
  const legend = make('div', 'skill-legend');
  legend.append(
    make('span', 'legend-dot available', 'AVAILABLE'),
    make('span', 'legend-dot unlocked', 'UNLOCKED'),
    make('span', 'legend-dot locked', 'LOCKED')
  );
  root.append(legend);

  const map = make('div', 'skill-tree');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.classList.add('skill-links');
  for (const node of SKILL_TREE) {
    for (const parentId of node.requires) {
      const parent = SKILL_TREE.find((candidate) => candidate.id === parentId);
      if (!parent) continue;
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', parent.x); line.setAttribute('y1', 100 - parent.y);
      line.setAttribute('x2', node.x); line.setAttribute('y2', 100 - node.y);
      line.setAttribute('class', skills[node.id] ? 'skill-link on' : 'skill-link');
      svg.append(line);
    }
  }
  map.append(svg);
  for (const node of SKILL_TREE) {
    const isUnlocked = !!skills[node.id];
    const canUnlock = !isUnlocked && node.requires.every((required) => skills[required]);
    const short = canUnlock && points < node.cost;
    const button = make('button', 'skill-node' + (isUnlocked ? ' unlocked' : canUnlock ? ' available' : ' locked') + (short ? ' short' : ''));
    button.type = 'button';
    button.style.left = 'clamp(var(--node-half), ' + node.x + '%, calc(100% - var(--node-half)))';
    button.style.top = (100 - node.y) + '%';
    button.disabled = !canUnlock || short;
    button.title = isUnlocked
      ? 'Unlocked: ' + node.desc
      : !canUnlock
        ? 'Unlock the preceding node first'
        : short
          ? 'Needs ' + node.cost + ' skill point' + (node.cost === 1 ? '' : 's')
          : 'Spend ' + node.cost + ' point' + (node.cost === 1 ? '' : 's');
    button.append(make('strong', '', node.name));
    button.append(make('small', '', node.branch + ' · ' + node.cost + ' SP' + (isUnlocked ? ' · ONLINE' : '')));
    button.append(make('span', '', node.desc));
    button.addEventListener('click', () => actions.unlockSkill(node.id));
    map.append(button);
  }
  root.append(map);
  root.append(make('p', 'menu-empty', 'Hover or tap a node to read its effect. Unlocked nodes apply immediately — no respawn needed.'));
}

export function renderInventoryPage(root, { player, actions, refresh }) {
  root.replaceChildren();
  if (!player) { empty(root, 'Join the Conduit to open your inventory.'); return; }
  const domain = DOMAINS[player.energyColor] || DOMAINS.cipher;
  const equippedCount = SLOTS.filter(([slot]) => ITEM_CATALOG[player.equipped?.[slot]]).length;

  section(root, 'EQUIPPED LOADOUT');
  const doll = make('div', 'paperdoll');
  doll.style.setProperty('--domain', domain.primary);
  doll.style.setProperty('--domain-accent', domain.accent);
  doll.append(paperdollFigure());
  for (const [slot, label] of SLOTS) doll.append(paperdollSlot(slot, label, player, refresh));
  root.append(doll);

  const loadoutNote = make('div', 'loadout-note');
  loadoutNote.append(
    make('strong', '', equippedCount + ' / ' + SLOTS.length + ' SLOTS FILLED'),
    make('span', '', 'GEAR POWER +' + (player.gearAtk || 0) + ' ATK · TOTAL ' + ((player.atk || 0) + (player.gearAtk || 0)) + ' ATK')
  );
  root.append(loadoutNote);

  section(root, 'RESOURCES');
  const resources = make('div', 'resource-row');
  for (const [label, value] of [
    ['CREDITS', player.credits || 0],
    ['CORE CHARGE', Math.floor(player.coreCharge || 0) + '%'],
    ['XP', player.xp || 0],
    ['SKILL POINTS', player.skillPoints || 0]
  ]) {
    const chip = make('div', 'resource-chip');
    chip.append(make('small', '', label)); chip.append(make('strong', '', String(value)));
    resources.append(chip);
  }
  root.append(resources);

  section(root, 'PACK');
  const filterRow = make('div', 'gear-filter-row');
  for (const [slot, label] of [['all', 'ALL'], ...SLOTS]) {
    const chip = make('button', 'gear-filter' + (gearFilter === slot ? ' selected' : ''), label);
    chip.type = 'button';
    chip.setAttribute('aria-pressed', String(gearFilter === slot));
    chip.addEventListener('click', () => { gearFilter = slot; refresh?.(); });
    filterRow.append(chip);
  }
  root.append(filterRow);

  const inventory = (player.inventory || []).map((id) => ITEM_CATALOG[id]).filter(Boolean);
  const shown = inventory
    .filter((item) => gearFilter === 'all' || item.slot === gearFilter)
    .sort((a, b) => (SLOT_ORDER[a.slot] ?? 9) - (SLOT_ORDER[b.slot] ?? 9));
  if (!inventory.length) empty(root, 'Your pack is empty. Visit a city merchant to buy gear.');
  else if (!shown.length) empty(root, 'No ' + (gearFilter === 'all' ? '' : gearFilter + ' ') + 'gear in your pack. Choose another slot or ALL.');
  const grid = make('div', 'inventory-grid');
  for (const item of shown) {
    const equipped = player.equipped?.[item.slot] === item.id;
    const card = make('div', 'inventory-card' + (equipped ? ' equipped' : ''));
    card.append(make('strong', '', item.name));
    card.append(make('small', 'inventory-slot', item.tier + ' · ' + item.slot.toUpperCase() + (item.atkBonus ? ' · ATK +' + item.atkBonus : '')));
    card.append(make('p', '', item.desc || ''));
    if (SLOT_ORDER[item.slot] !== undefined) {
      const controls = make('div', 'inventory-actions');
      if (equipped) {
        controls.append(make('span', 'equipped-tag', 'EQUIPPED'));
        const remove = make('button', 'menu-action ghost', 'UNEQUIP');
        remove.type = 'button';
        remove.addEventListener('click', () => actions.unequipItem(item.slot));
        controls.append(remove);
      } else {
        const button = make('button', 'menu-action', 'EQUIP');
        button.type = 'button';
        button.addEventListener('click', () => actions.equipItem(item.id));
        controls.append(button);
      }
      card.append(controls);
    }
    grid.append(card);
  }
  root.append(grid);
}

export function renderPartyPage(root, { player, state, actions }) {
  root.replaceChildren();
  if (!player) { empty(root, 'Join the Conduit to manage your squad.'); return; }
  section(root, 'OPERATIVE SQUAD');
  const party = state.party;
  if (!party || !Array.isArray(party.members) || party.members.length < 2) {
    empty(root, 'No active squad. Invite nearby operatives by clicking a chat name.');
  } else {
    const list = make('div', 'friend-list');
    for (const member of party.members) {
      const row = make('div', 'friend-row');
      row.append(make('strong', '', member.name + (member.id === party.leaderId ? ' ★' : '')));
      row.append(make('small', '', 'HP ' + Math.ceil(member.hp) + '/' + member.maxHp + ' · ' + (member.zoneId || '')));
      if (member.id !== player.id && party.leaderId === player.id) {
        // Leader can hand out invites too; leaving is available in the HUD widget.
        row.append(make('span', 'friend-tag', 'SQUAD'));
      }
      list.append(row);
    }
    root.append(list);
    const leave = make('button', 'menu-action', 'LEAVE SQUAD');
    leave.type = 'button';
    leave.addEventListener('click', () => actions.leaveParty());
    root.append(leave);
  }

  section(root, 'FRIENDS');
  const friends = state.friends || player.friends || [];
  if (!friends.length) empty(root, 'No friends yet. Click a name in chat to send a friend request.');
  const friendList = make('div', 'friend-list');
  for (const friend of friends) {
    const row = make('div', 'friend-row');
    row.append(make('strong', '', friend.name));
    row.append(make('small', '', friend.zoneId || 'offline'));
    const invite = make('button', 'menu-action', 'INVITE');
    invite.type = 'button';
    invite.addEventListener('click', () => actions.invitePlayer(friend.id));
    const remove = make('button', 'menu-action ghost', 'REMOVE');
    remove.type = 'button';
    remove.addEventListener('click', () => actions.removeFriend(friend.id));
    row.append(invite, remove);
    friendList.append(row);
  }
  root.append(friendList);

  section(root, 'OPERATIVES IN ZONE');
  const others = Object.values(state.players || {}).filter((candidate) => candidate.id !== player.id);
  if (!others.length) empty(root, 'No other operatives in this zone.');
  for (const other of others.slice(0, 8)) {
    const row = make('div', 'friend-row');
    row.append(make('strong', '', other.name));
    row.append(make('small', '', 'LV ' + (other.level || 1) + ' · ' + (other.energyColor || 'cipher')));
    const invite = make('button', 'menu-action', 'PARTY');
    invite.type = 'button';
    invite.addEventListener('click', () => actions.invitePlayer(other.id));
    row.append(invite);
    root.append(row);
  }
}

export function renderInboxPage(root, { player, state, actions }) {
  root.replaceChildren();
  if (!player) { empty(root, 'Join the Conduit to check your inbox.'); return; }
  const inbox = state.inbox || player.inbox || [];
  section(root, 'TRANSMISSIONS · ' + inbox.length);
  if (!inbox.length) { empty(root, 'No transmissions. Gifts and system rewards arrive here.'); return; }
  for (const message of inbox) {
    const card = make('div', 'inbox-card' + (message.claimed ? ' claimed' : ''));
    card.append(make('strong', '', message.subject || 'Transmission'));
    card.append(make('small', '', 'FROM ' + (message.from || 'SYSTEM') + ' · ' + new Date(message.at || Date.now()).toLocaleDateString()));
    card.append(make('p', '', message.body || ''));
    const item = ITEM_CATALOG[message.itemId];
    if (item) {
      card.append(make('em', '', 'ATTACHMENT: ' + item.name));
      const claim = make('button', 'menu-action', message.claimed ? 'CLAIMED' : 'CLAIM');
      claim.type = 'button';
      claim.disabled = !!message.claimed;
      claim.addEventListener('click', () => actions.claimInbox(message.id));
      card.append(claim);
    }
    root.append(card);
  }
}

export function renderMapPage(root, { player, state, actions }) {
  root.replaceChildren();
  if (!player) { empty(root, 'Join the Conduit to open the world map.'); return; }
  const map = (state.worldMap || []).filter((zone) => zone.kind !== 'arena');
  const unlocked = new Set(player.unlockedCities || ['haven-perimeter']);
  const towers = player.towers || {};
  const currentId = state.zone?.id || player.zoneId;
  const canvas = document.createElement('canvas');
  canvas.className = 'menu-map';
  canvas.width = 660; canvas.height = 360;
  const draw = canvas.getContext('2d');
  draw.fillStyle = '#07131b'; draw.fillRect(0, 0, canvas.width, canvas.height);
  draw.strokeStyle = 'rgba(120,255,224,.06)'; draw.lineWidth = 1;
  for (let x = 0; x <= canvas.width; x += 44) { draw.beginPath(); draw.moveTo(x, 0); draw.lineTo(x, canvas.height); draw.stroke(); }
  for (let y = 0; y <= canvas.height; y += 44) { draw.beginPath(); draw.moveTo(0, y); draw.lineTo(canvas.width, y); draw.stroke(); }

  const ordered = map.filter((zone) => zone.kind !== 'tower').sort((a, b) => a.order - b.order);
  const pointFor = (zone, branch) => {
    const x = 54 + (zone.order / Math.max(1, ordered[ordered.length - 1].order)) * (canvas.width - 108);
    return { x, y: branch ? 108 : 236 };
  };
  // Road connectors first so nodes sit on top.
  draw.strokeStyle = 'rgba(126,255,224,.28)'; draw.lineWidth = 3;
  for (let i = 1; i < ordered.length; i += 1) {
    const a = pointFor(ordered[i - 1], false), b = pointFor(ordered[i], false);
    draw.beginPath(); draw.moveTo(a.x, a.y); draw.lineTo(b.x, b.y); draw.stroke();
  }
  // Tower branch lines.
  for (const tower of map.filter((zone) => zone.kind === 'tower')) {
    const haven = ordered.find((zone) => zone.id === tower.havenId);
    if (!haven) continue;
    const a = pointFor(haven, false), b = pointFor(haven, true);
    const done = !!towers[tower.towerIndex];
    draw.strokeStyle = done ? 'rgba(125,255,216,.75)' : 'rgba(126,168,155,.35)';
    draw.setLineDash(done ? [] : [5, 6]);
    draw.beginPath(); draw.moveTo(a.x, a.y - 16); draw.lineTo(b.x, b.y + 16); draw.stroke();
    draw.setLineDash([]);
  }
  for (const zone of map) {
    const isTower = zone.kind === 'tower';
    const p = pointFor(zone, isTower);
    const isHaven = zone.kind === 'haven';
    const done = isTower ? !!towers[zone.towerIndex] : unlocked.has(zone.id);
    const current = zone.id === currentId;
    draw.fillStyle = current ? '#ffffff' : isHaven ? (done ? '#7dffd8' : '#3f6d68') : (done ? '#8ce0ff' : '#35606b');
    draw.beginPath(); draw.arc(p.x, p.y, isTower ? 9 : isHaven ? 11 : 6, 0, Math.PI * 2); draw.fill();
    if (isHaven || isTower) {
      draw.strokeStyle = done ? 'rgba(186,255,238,.9)' : 'rgba(120,151,141,.65)';
      draw.lineWidth = 1.5; draw.beginPath(); draw.arc(p.x, p.y, isTower ? 14 : 16, 0, Math.PI * 2); draw.stroke();
    }
    draw.fillStyle = current ? '#ffffff' : (done ? '#dffcf5' : '#87a5a0');
    draw.font = (isHaven ? '700 10px' : '9px') + ' system-ui';
    draw.textAlign = 'center';
    draw.fillText(zone.name.split(' · ').pop(), p.x, p.y + (isTower ? -20 : 28));
    if (isTower) draw.fillText(done ? 'ONLINE' : 'DORMANT', p.x, p.y - 30);
  }
  draw.fillStyle = 'rgba(210,245,240,.9)'; draw.font = '800 12px system-ui'; draw.textAlign = 'left';
  draw.fillText('WORLD ROUTE · CITIES, WILDS & FIVE TOWERS', 14, 20);
  root.append(canvas);

  section(root, 'UNLOCKED SPAWN POINTS');
  const cities = map.filter((zone) => zone.kind === 'haven').sort((a, b) => a.order - b.order);
  const list = make('div', 'friend-list');
  for (const city of cities) {
    const row = make('div', 'friend-row');
    const isUnlocked = unlocked.has(city.id);
    row.append(make('strong', '', city.name + (city.id === player.homeCity ? ' ★ HOME' : '')));
    row.append(make('small', '', isUnlocked ? (city.towerIndex ? 'Tower ' + city.towerIndex + (towers[city.towerIndex] ? ' online' : ' dormant') : 'Starting village') : 'Not yet reached'));
    const travel = make('button', 'menu-action' + (city.id === currentId ? ' ghost' : ''), city.id === currentId ? 'HERE' : 'FAST TRAVEL');
    travel.type = 'button';
    travel.disabled = !isUnlocked || city.id === currentId;
    travel.addEventListener('click', () => actions.fastTravel?.(city.id));
    row.append(travel);
    list.append(row);
  }
  root.append(list);

  if (state.zone?.kind === 'arena' || state.zone?.kind === 'tower') {
    const home = make('button', 'menu-action', 'RETURN TO ' + (player.homeCity || 'haven-perimeter').replace('haven-', '').toUpperCase());
    home.type = 'button';
    home.addEventListener('click', () => actions.fastTravel?.(player.homeCity || 'haven-perimeter'));
    root.append(home);
  }
  root.append(make('p', 'menu-empty', 'Reach a city on foot to unlock its spawn point. Clear its tower to open the next road east.'));
}

export function renderSettingsPage(root, { actions, refresh }) {
  root.replaceChildren();
  section(root, 'AUDIO');
  const sound = make('button', 'settings-toggle' + (actions.isMuted?.() ? ' off' : ''), actions.isMuted?.() ? 'SFX: OFF' : 'SFX: ON');
  sound.type = 'button';
  sound.addEventListener('click', () => { actions.toggleSfx?.(); refresh(); });
  root.append(sound);

  section(root, 'COMBAT CONTROLS');
  const shootingMode = getShootingMode();
  const shootingToggle = make('button', 'settings-toggle', shootingMode === SHOOTING_MODE.AUTO ? 'AUTO-AIM · HOLD TO FIRE' : 'TWIN-STICK · MANUAL AIM');
  shootingToggle.type = 'button';
  shootingToggle.setAttribute('aria-label', 'Shooting style');
  shootingToggle.setAttribute('aria-pressed', String(shootingMode === SHOOTING_MODE.TWIN));
  shootingToggle.addEventListener('click', () => {
    setShootingMode(shootingMode === SHOOTING_MODE.AUTO ? SHOOTING_MODE.TWIN : SHOOTING_MODE.AUTO);
    refresh();
  });
  root.append(shootingToggle);
  root.append(make('p', 'menu-empty', shootingMode === SHOOTING_MODE.AUTO
    ? 'Press or hold BLAST; shots seek the nearest hostile. Twin-stick adds a right aim stick / right gamepad stick.'
    : 'Aim with the right touch stick, right gamepad stick, or mouse; hold BLAST to fire.'));

  section(root, 'KEYBINDS');
  const binds = loadKeybinds();
  const list = make('div', 'keybind-list');
  for (const action of KEYBIND_ACTIONS) {
    const row = make('div', 'keybind-row');
    row.append(make('span', '', action.label));
    const button = make('button', 'keybind-button', keyLabel(binds[action.id]));
    button.type = 'button';
    button.addEventListener('click', () => {
      button.textContent = 'PRESS A KEY…';
      button.classList.add('capturing');
      const capture = (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        binds[action.id] = event.code;
        saveKeybinds(binds);
        refresh();
      };
      window.addEventListener('keydown', capture, { once: true, capture: true });
    });
    row.append(button);
    list.append(row);
  }
  root.append(list);

  section(root, 'SESSION');
  const exit = make('button', 'menu-action danger', 'EXIT TO TITLE');
  exit.type = 'button';
  exit.addEventListener('click', () => actions.exitToTitle?.());
  root.append(exit);
}

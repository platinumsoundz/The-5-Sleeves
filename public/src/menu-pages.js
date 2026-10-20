// Renderers for the expanded MENU pages. Pure DOM builders: they read the
// live player/state and call back into the UI actions, so uiManager.js stays a
// thin coordinator. No top-level DOM access (safe to import in tests).
import { DOMAINS, HUB, ITEM_CATALOG, SKILL_TREE, TOWERS, WORLD_DEFAULT } from './config.js';
import { KEYBIND_ACTIONS, keyLabel, loadKeybinds, saveKeybinds } from './keybinds.js';

const SLOTS = [['head', 'HEAD'], ['chest', 'CHEST'], ['legs', 'LEGS'], ['feet', 'FEET'], ['weapon', 'WEAPON']];

function make(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function section(root, title) {
  const heading = make('h3', 'menu-section-title', title);
  root.append(heading);
  return heading;
}

function empty(root, text) {
  root.append(make('p', 'menu-empty', text));
}

export function renderCharacterPage(root, { player, actions }) {
  root.replaceChildren();
  if (!player) { empty(root, 'Join the Conduit to inspect your operative.'); return; }
  section(root, 'GEAR SLOTS');
  const gear = make('div', 'gear-grid');
  for (const [slot, label] of SLOTS) {
    const item = ITEM_CATALOG[player.equipped?.[slot]];
    const cell = make('div', 'gear-slot' + (item ? ' filled' : ''));
    cell.append(make('span', 'gear-slot-label', label));
    cell.append(make('strong', 'gear-slot-name', item ? item.name : 'EMPTY'));
    cell.append(make('small', 'gear-slot-tier', item ? item.tier : 'No item equipped'));
    gear.append(cell);
  }
  root.append(gear);

  section(root, 'ACTIVE SLEEVE SPECS');
  const domain = DOMAINS[player.energyColor] || DOMAINS.cipher;
  const specs = make('div', 'spec-strip');
  for (const [label, value, color] of [
    ['DOMAIN', domain.label, domain.primary],
    ['ABILITY', player.abilityName || 'Conduit Pulse', domain.accent],
    ['LEVEL', 'LV ' + (player.level || 1), '#ffe9a0'],
    ['POWER', 'ATK ' + (player.atk || 0), '#8effe6'],
    ['PLATING', 'HP ' + (player.plating || 0), '#8ce0ff'],
    ['OVERCLOCK', 'SPD ' + (player.overclock || 0), '#c9a6ff']
  ]) {
    const chip = make('div', 'spec-chip');
    chip.append(make('small', '', label));
    chip.append(make('strong', '', value));
    chip.style.borderColor = color;
    specs.append(chip);
  }
  root.append(specs);

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
    button.disabled = (player.skillPoints || 0) <= 0 || (player[stat] || 0) >= 99;
    button.addEventListener('click', () => actions.upgrade(stat));
    row.append(copy, level, button);
    root.append(row);
  }

  section(root, 'SLEEVE DOMAIN');
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
}

export function renderSkillsPage(root, { player, actions }) {
  root.replaceChildren();
  if (!player) { empty(root, 'Join the Conduit to unlock sleeve nodes.'); return; }
  root.append(make('p', 'menu-empty', 'Spend skill points to branch into active and passive sleeve paths.'));
  const map = make('div', 'skill-tree');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.classList.add('skill-links');
  const skills = player.skills || {};
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
    const unlocked = !!skills[node.id];
    const available = !unlocked && node.requires.every((required) => skills[required]);
    const button = make('button', 'skill-node' + (unlocked ? ' unlocked' : available ? ' available' : ' locked'));
    button.type = 'button';
    button.style.left = node.x + '%';
    button.style.top = (100 - node.y) + '%';
    button.disabled = !available || (player.skillPoints || 0) < node.cost;
    button.append(make('strong', '', node.name));
    button.append(make('small', '', node.branch + ' · ' + node.cost + ' SP'));
    button.append(make('span', '', node.desc));
    button.addEventListener('click', () => actions.unlockSkill(node.id));
    map.append(button);
  }
  root.append(map);
  root.append(make('p', 'menu-empty', 'Unlocked nodes: ' + Object.keys(skills).length + '/' + SKILL_TREE.length + ' · Skill points: ' + (player.skillPoints || 0)));
}

export function renderInventoryPage(root, { player, actions }) {
  root.replaceChildren();
  if (!player) { empty(root, 'Join the Conduit to open your inventory.'); return; }
  section(root, 'RESOURCES');
  const resources = make('div', 'resource-row');
  for (const [label, value] of [
    ['CORE POINTS', player.corePoints || 0],
    ['CORE CHARGE', Math.floor(player.coreCharge || 0) + '%'],
    ['XP', player.xp || 0],
    ['SKILL POINTS', player.skillPoints || 0]
  ]) {
    const chip = make('div', 'resource-chip');
    chip.append(make('small', '', label)); chip.append(make('strong', '', String(value)));
    resources.append(chip);
  }
  root.append(resources);

  section(root, 'ITEMS & GEAR');
  const inventory = player.inventory || [];
  if (!inventory.length) empty(root, 'Your pack is empty. Visit Quartermaster Vale in the safe hub.');
  const grid = make('div', 'inventory-grid');
  for (const id of inventory) {
    const item = ITEM_CATALOG[id];
    if (!item) continue;
    const card = make('div', 'inventory-card');
    card.append(make('strong', '', item.name));
    card.append(make('small', 'inventory-slot', item.tier + ' · ' + item.slot.toUpperCase()));
    card.append(make('p', '', item.desc || ''));
    const equipped = player.equipped?.[item.slot] === item.id;
    if (item.slot !== 'supply') {
      const button = make('button', 'menu-action' + (equipped ? ' selected' : ''), equipped ? 'EQUIPPED' : 'EQUIP');
      button.type = 'button';
      button.disabled = equipped;
      button.addEventListener('click', () => actions.equipItem(item.id));
      card.append(button);
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

export function renderMapPage(root, { player, state }) {
  root.replaceChildren();
  if (!player) { empty(root, 'Join the Conduit to open the regional map.'); return; }
  const world = state.world || WORLD_DEFAULT;
  const canvas = document.createElement('canvas');
  canvas.className = 'menu-map';
  canvas.width = 640; canvas.height = 420;
  const draw = canvas.getContext('2d');
  const sx = canvas.width / world.width, sy = canvas.height / world.height;
  draw.fillStyle = '#07131b'; draw.fillRect(0, 0, canvas.width, canvas.height);
  draw.strokeStyle = 'rgba(120,255,224,.08)'; draw.lineWidth = 1;
  for (let x = 0; x <= canvas.width; x += 40) { draw.beginPath(); draw.moveTo(x, 0); draw.lineTo(x, canvas.height); draw.stroke(); }
  for (let y = 0; y <= canvas.height; y += 40) { draw.beginPath(); draw.moveTo(0, y); draw.lineTo(canvas.width, y); draw.stroke(); }
  const safe = state.hub || HUB;
  if (safe && !state.zone?.arena) {
    draw.fillStyle = 'rgba(80,255,214,.08)';
    draw.beginPath(); draw.arc(safe.x * sx, safe.y * sy, safe.radius * sx, 0, Math.PI * 2); draw.fill();
    draw.strokeStyle = 'rgba(126,255,224,.55)';
    draw.beginPath(); draw.arc(safe.x * sx, safe.y * sy, safe.radius * sx, 0, Math.PI * 2); draw.stroke();
  }
  const towers = state.towers?.length ? state.towers : TOWERS;
  for (const tower of towers) {
    draw.fillStyle = tower.unlocked ? '#7dffd8' : '#78978d';
    draw.fillRect(tower.x * sx - 4, tower.y * sy - 10, 8, 20);
    draw.fillRect(tower.x * sx - 10, tower.y * sy - 4, 20, 8);
    draw.fillStyle = tower.unlocked ? 'rgba(125,255,216,.9)' : 'rgba(140,170,162,.75)';
    draw.font = '9px system-ui'; draw.textAlign = 'center';
    draw.fillText(tower.name + (tower.unlocked ? ' · ONLINE' : ' · DORMANT'), tower.x * sx, tower.y * sy - 16);
  }
  for (const npc of state.npcs || []) {
    draw.fillStyle = npc.color || '#ffd479';
    draw.beginPath(); draw.arc(npc.x * sx, npc.y * sy, 4, 0, Math.PI * 2); draw.fill();
  }
  for (const node of Object.values((state.objectives || {}).nodes || {})) {
    draw.strokeStyle = node.ownerColor || 'rgba(170,210,220,.7)';
    draw.beginPath(); draw.arc(node.x * sx, node.y * sy, 6, 0, Math.PI * 2); draw.stroke();
  }
  for (const other of Object.values(state.players || {})) {
    draw.fillStyle = other.id === player.id ? '#ffffff' : (other.color || '#8ef');
    draw.beginPath(); draw.arc(other.x * sx, other.y * sy, other.id === player.id ? 4 : 3, 0, Math.PI * 2); draw.fill();
  }
  draw.fillStyle = 'rgba(210,245,240,.85)'; draw.font = '700 10px system-ui'; draw.textAlign = 'left';
  draw.fillText('REGIONAL TOWER NETWORK · ' + (state.zone?.name || 'THE PERIMETER').toUpperCase(), 10, 18);
  root.append(canvas);
  root.append(make('p', 'menu-empty', 'Dormant towers push the fogline back when you stand inside their ring. Online towers reveal the surrounding terrain.'));
  if (state.zone?.arena) {
    const back = make('button', 'menu-action', 'RETURN TO SAFE HUB');
    back.type = 'button';
    back.addEventListener('click', () => actions.switchZone?.('the-perimeter'));
    root.append(back);
  }
}

export function renderSettingsPage(root, { actions, refresh }) {
  root.replaceChildren();
  section(root, 'AUDIO');
  const sound = make('button', 'settings-toggle' + (actions.isMuted?.() ? ' off' : ''), actions.isMuted?.() ? 'SFX: OFF' : 'SFX: ON');
  sound.type = 'button';
  sound.addEventListener('click', () => { actions.toggleSfx?.(); refresh(); });
  root.append(sound);

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

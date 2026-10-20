// Renderers for the expanded MENU pages. Pure DOM builders: they read the
// live player/state and call back into the UI actions, so uiManager.js stays a
// thin coordinator. No top-level DOM access (safe to import in tests).
import { DOMAINS, ITEM_CATALOG, SKILL_TREE, WORLD_DEFAULT } from './config.js';
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
    ['POWER', 'ATK ' + ((player.atk || 0) + (player.gearAtk || 0)) + (player.gearAtk ? ' (+' + player.gearAtk + ')' : ''), '#8effe6'],
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
    button.style.left = 'clamp(var(--node-half), ' + node.x + '%, calc(100% - var(--node-half)))';
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

  section(root, 'ITEMS & GEAR');
  const inventory = player.inventory || [];
  if (!inventory.length) empty(root, 'Your pack is empty. Visit a city merchant to buy gear.');
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

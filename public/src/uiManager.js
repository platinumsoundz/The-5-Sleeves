import { PROFILE_KEY, WORLD_DEFAULT } from './config.js';

export function createUIManager(actions) {
  const $ = (selector) => document.querySelector(selector);
  const title = $('#title-screen'), form = $('#join-form'), nameInput = $('#username-input');
  const enterButton = $('#enter-button'), nameError = $('#name-error'), menu = $('#character-menu');
  const hints = $('#control-hints'), status = $('#status'), archiveToast = $('#archive-toast');
  const partyWidget = $('#party-widget'), partyMap = $('#party-minimap'), partyMembers = $('#party-members');
  const inviteToast = $('#party-invite-toast'), inviteMessage = $('#party-invite-message');
  const chatList = $('#chat-messages'), chatForm = $('#chat-form'), chatInput = $('#chat-input');
  const abilityButton = $('#ability-button');
  let joined = false, activeChannel = 'global', currentInvite = null, toastTimer = null, inviteTimer = null;
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
    $('#skill-points').textContent = 'Level ' + (player.level || 1) + ' · Skill Points: ' + (player.skillPoints || 0);
    $('#atk-level').textContent = 'Lv ' + (player.atk || 0);
    $('#plating-level').textContent = 'Lv ' + (player.plating || 0);
    $('#overclock-level').textContent = 'Lv ' + (player.overclock || 0);
    document.querySelectorAll('.upgrade-button').forEach((button) => {
      button.disabled = !joined || (player.skillPoints || 0) <= 0 || (player[button.dataset.upgrade] || 0) >= 99;
    });
    document.querySelectorAll('.color-option').forEach((button) => button.classList.toggle('selected', button.dataset.color === player.energyColor));
  }
  function showToast(message, duration = 4500) {
    archiveToast.textContent = message;
    archiveToast.classList.add('visible');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => archiveToast.classList.remove('visible'), duration);
  }
  function appendChat(message, system = false) {
    const item = document.createElement('li');
    if (system) { item.className = 'chat-system'; item.textContent = message; }
    else {
      const channel = document.createElement('span'); channel.className = 'chat-channel';
      channel.textContent = '[' + String(message.channel || 'global').toUpperCase() + '] ';
      const name = document.createElement('strong'); name.textContent = String(message.name || 'Operative') + ': ';
      const text = document.createElement('span'); text.textContent = String(message.text || '');
      item.append(channel, name, text);
    }
    chatList.appendChild(item);
    while (chatList.children.length > 60) chatList.firstElementChild.remove();
    chatList.scrollTop = chatList.scrollHeight;
  }
  function selectChatChannel(channel) {
    if (!['global', 'squad', 'faction'].includes(channel)) return;
    activeChannel = channel;
    document.querySelectorAll('.chat-tab').forEach((button) => button.classList.toggle('selected', button.dataset.chatChannel === channel));
    chatInput.placeholder = channel === 'squad' ? 'Squad message… (/s)' : channel === 'faction' ? 'Faction message… (/f)' : 'Global message… (/g, !)';
  }
  function renderParty(party) {
    if (!party || !Array.isArray(party.members) || party.members.length < 2) {
      partyWidget.classList.add('hidden');
      partyMembers.replaceChildren();
      return;
    }
    partyWidget.classList.remove('hidden');
    const ctx = partyMap.getContext('2d'), world = actions.getWorld?.() || WORLD_DEFAULT;
    ctx.clearRect(0, 0, partyMap.width, partyMap.height);
    ctx.fillStyle = '#111b1b'; ctx.fillRect(0, 0, partyMap.width, partyMap.height);
    ctx.strokeStyle = 'rgba(133,176,155,.18)'; ctx.lineWidth = 1;
    for (let x = 0; x <= partyMap.width; x += 30) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, partyMap.height); ctx.stroke(); }
    for (let y = 0; y <= partyMap.height; y += 21) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(partyMap.width, y); ctx.stroke(); }
    const colors = { cipher: '#00ffff', wind: '#00ff88', water: '#0088ff', fire: '#ff4400', earth: '#cc7722', dark: '#bd38f5' };
    party.members.forEach((member) => {
      const x = Math.max(4, Math.min(partyMap.width - 4, member.x / world.width * partyMap.width));
      const y = Math.max(4, Math.min(partyMap.height - 4, member.y / world.height * partyMap.height));
      ctx.fillStyle = colors[member.energyColor] || '#d9fff5'; ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
      if (member.id === actions.getPlayer?.()?.id) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke(); }
    });
    partyMembers.replaceChildren();
    party.members.forEach((member) => {
      const row = document.createElement('div'); row.className = 'party-member';
      const label = document.createElement('span'); label.className = 'party-member-name' + (member.id === party.leaderId ? ' leader' : '');
      label.textContent = member.name + (member.id === actions.getPlayer?.()?.id ? ' (You)' : '');
      const bar = document.createElement('div'); bar.className = 'party-health';
      const fill = document.createElement('div'); fill.className = 'party-health-fill';
      fill.style.width = Math.max(0, Math.min(100, member.hp / Math.max(1, member.maxHp) * 100)) + '%';
      bar.appendChild(fill);
      const xp = document.createElement('small'); xp.className = 'party-xp'; xp.textContent = 'HP ' + Math.ceil(member.hp) + '/' + member.maxHp + ' · Shared XP ' + (member.partyXp || 0).toFixed(2);
      row.append(label, bar, xp); partyMembers.appendChild(row);
    });
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const name = nameInput.value.trim();
    if (!name) { nameError.textContent = 'Enter a character name.'; return; }
    nameError.textContent = ''; enterButton.disabled = true; actions.join(name);
  });
  $('#specs-button').addEventListener('click', () => actions.toggleMenu());
  $('#menu-close').addEventListener('click', () => menu.classList.add('hidden'));
  menu.addEventListener('click', (event) => { if (event.target === menu) menu.classList.add('hidden'); });
  document.querySelectorAll('.upgrade-button').forEach((button) => button.addEventListener('click', () => actions.upgrade(button.dataset.upgrade)));
  document.querySelectorAll('.color-option').forEach((button) => button.addEventListener('click', () => actions.selectDomain(button.dataset.color)));
  $('#party-leave').addEventListener('click', () => actions.leaveParty());
  document.querySelectorAll('.chat-tab').forEach((button) => button.addEventListener('click', () => selectChatChannel(button.dataset.chatChannel)));
  chatForm.addEventListener('submit', (event) => {
    event.preventDefault();
    let text = chatInput.value.trim(), channel = activeChannel;
    const command = text.match(/^\/(s|g|f)(?:\s+|$)(.*)$/i);
    if (command) { channel = ({ s: 'squad', g: 'global', f: 'faction' })[command[1].toLowerCase()]; text = command[2].trim(); }
    else if (text.startsWith('!')) { channel = 'global'; text = text.slice(1).trim(); }
    if (!text) return;
    actions.sendChat(channel, text); chatInput.value = '';
  });
  $('#party-accept').addEventListener('click', () => {
    if (currentInvite) actions.respondParty(currentInvite.inviteId, true);
    currentInvite = null; inviteToast.classList.add('hidden');
  });
  $('#party-decline').addEventListener('click', () => {
    if (currentInvite) actions.respondParty(currentInvite.inviteId, false);
    currentInvite = null; inviteToast.classList.add('hidden');
  });

  return {
    setStatus(message, connected) { status.textContent = message; status.classList.toggle('offline', !connected); },
    joinAccepted({ name, stats }) {
      joined = true; profile = { ...profile, name, ...stats }; saveProfile();
      title.classList.add('hidden'); enterButton.disabled = false; nameError.textContent = '';
      status.textContent = 'Welcome, ' + name; updateMenu(profile);
    },
    joinError(message) { nameError.textContent = message; enterButton.disabled = false; },
    showArchiveToast: showToast,
    updatePlayer(player) {
      profile = { name: player.name, hp: player.hp, maxHp: player.maxHp, coreCharge: player.coreCharge, corePoints: player.corePoints, skillPoints: player.skillPoints, partyXp: player.partyXp, atk: player.atk, plating: player.plating, overclock: player.overclock, energyColor: player.energyColor };
      saveProfile(); updateMenu(player);
      if (player.abilityShort) {
        abilityButton.textContent = player.abilityShort;
        abilityButton.setAttribute('aria-label', 'Cast ' + (player.abilityName || 'sleeve ability'));
      }
      abilityButton.dataset.ready = player.abilityCooldown > 0 ? 'false' : 'true';
    },
    setInputMode(mode) {
      document.body.dataset.inputMode = mode;
      if (mode === 'keyboard') hints.innerHTML = '<span class="control-badge">WASD / ↑↓←→</span> Move &nbsp; <span class="control-badge">SPACE</span> Blast<br /><span class="control-badge">SHIFT</span> Dash &nbsp; <span class="control-badge">E</span> Shield &nbsp; <span class="control-badge">Q</span> Sleeve<br /><span class="control-badge">F</span> Read &nbsp; <span class="control-badge">C</span> Specs &nbsp; <span class="control-badge">+ / −</span> Zoom';
      else if (mode === 'controller') hints.innerHTML = '<span class="control-badge">STICK / D-PAD</span> Move &nbsp; <span class="control-badge">A / R1</span> Blast<br /><span class="control-badge">X / L1</span> Dash &nbsp; <span class="control-badge">B / L2</span> Shield &nbsp; <span class="control-badge">RT</span> Sleeve<br /><span class="control-badge">Y</span> Read &nbsp; <span class="control-badge">START / SELECT</span> Specs';
      else hints.textContent = '';
    },
    toggleMenu(forceOpen) {
      if (!joined) return;
      const open = typeof forceOpen === 'boolean' ? forceOpen : menu.classList.contains('hidden');
      if (open) updateMenu(actions.getPlayer?.()); menu.classList.toggle('hidden', !open);
    },
    updateParty: renderParty,
    showPartyInvite(invite) {
      currentInvite = invite;
      inviteMessage.textContent = invite.inviterName + ' invites you to join their Operative Squad.';
      inviteToast.classList.remove('hidden');
      if (inviteTimer) clearTimeout(inviteTimer);
      inviteTimer = setTimeout(() => { currentInvite = null; inviteToast.classList.add('hidden'); }, (invite.expiresIn || 30) * 1000);
    },
    partyNotice(message) { appendChat(message, true); showToast(message, 3200); },
    partyError(message) { appendChat(message, true); showToast(message, 3800); },
    partyReward(reward) { appendChat('Squad assist: +' + reward.partyXp + ' shared XP from ' + reward.source + '.', true); },
    chatMessage: (message) => appendChat(message),
    chatError: (message) => appendChat(message, true),
    setBootStatus(text) { $('#boot-status').textContent = text; },
    // Zone picker on the title screen. `selectedZone` lives in the caller and
    // is read again on submit, so remembering the choice is the caller's job.
    renderZones(zones, selectedId) {
      const options = $('#zone-options');
      if (!options) return;
      options.innerHTML = '';
      for (const zone of zones) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'zone-option' + (zone.id === selectedId ? ' selected' : '');
        button.dataset.zone = zone.id;
        button.setAttribute('role', 'radio');
        button.setAttribute('aria-checked', String(zone.id === selectedId));
        button.innerHTML = '';
        button.append(zone.name);
        const meta = document.createElement('small');
        meta.textContent = zone.spirit + ' · ' + zone.players + ' online';
        button.append(meta);
        button.addEventListener('click', () => actions.selectZone(zone.id));
        options.append(button);
      }
    },
    toggleMenuFromInput(forceOpen) { this.toggleMenu(forceOpen); }
  };
}

import { DOMAINS, ITEM_CATALOG, PROFILE_KEY, WORLD_DEFAULT } from './config.js';
import { createMenu } from './menu.js';

export function createUIManager(actions) {
  const $ = (selector) => document.querySelector(selector);
  const title = $('#title-screen'), form = $('#join-form'), nameInput = $('#username-input');
  const enterButton = $('#enter-button'), nameError = $('#name-error');
  const accountMode = $('#account-mode'), passwordInput = $('#password-input');
  const hints = $('#control-hints'), status = $('#status'), archiveToast = $('#archive-toast');
  const partyWidget = $('#party-widget'), partyMap = $('#party-minimap'), partyMembers = $('#party-members');
  const inviteToast = $('#party-invite-toast'), inviteMessage = $('#party-invite-message');
  const chatList = $('#chat-messages'), chatForm = $('#chat-form'), chatInput = $('#chat-input');
  const chatPanel = $('#chat-panel'), chatToggle = $('#chat-toggle'), chatBadge = $('#chat-badge');
  const abilityButton = $('#ability-button');
  const chatActions = $('#chat-actions'), chatActionsName = $('#chat-actions-name'), chatActionsList = $('#chat-actions-list');
  const shopPanel = $('#shop-panel'), shopItems = $('#shop-items'), shopBalance = $('#shop-balance'), shopStatus = $('#shop-status');
  const arenaPanel = $('#arena-panel'), arenaOptions = $('#arena-options'), arenaNote = $('#arena-note'), arenaTitle = $('#arena-title');
  let joined = false, activeChannel = 'global', currentInvite = null, toastTimer = null, inviteTimer = null;
  let chatOpen = false, unreadChat = 0, chatTarget = null, shopPayload = null;
  let profile = {};
  try { profile = JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}') || {}; } catch (_) { profile = {}; }
  let profileSnapshot = JSON.stringify(profile);
  let menuSignature = '';
  let selectedFaction = DOMAINS[profile.energyColor] ? profile.energyColor : 'wind';
  if (typeof profile.name === 'string') nameInput.value = profile.name;

  const menuController = createMenu({ actions, getState: actions.getState, getPlayer: actions.getPlayer });

  // The five playable sleeve factions set aura, signature ability and /f channel.
  function renderFactions() {
    const options = $('#faction-options');
    if (!options) return;
    options.replaceChildren();
    for (const [key, info] of Object.entries(DOMAINS)) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'zone-option faction-option' + (key === selectedFaction ? ' selected' : '');
      button.dataset.faction = key;
      button.style.setProperty('--swatch', info.primary);
      button.setAttribute('role', 'radio');
      button.setAttribute('aria-checked', String(key === selectedFaction));
      button.append(info.label.replace(/ (Sleeve|Domain|Spirit)$/, ''));
      const meta = document.createElement('small');
      meta.textContent = info.short + ' · ' + key.toUpperCase();
      button.append(meta);
      button.addEventListener('click', () => {
        selectedFaction = key;
        renderFactions();
        options.querySelector('[data-faction="' + key + '"]')?.focus();
      });
      options.append(button);
    }
  }
  renderFactions();

  function saveProfile() {
    const serialized = JSON.stringify(profile);
    if (serialized === profileSnapshot) return;
    try { localStorage.setItem(PROFILE_KEY, serialized); profileSnapshot = serialized; } catch (_) {}
  }
  function updateMenu(player) {
    if (!player) return;
    const points = $('#skill-points');
    const zoneName = actions.getState?.()?.zone?.name || 'The Perimeter';
    if (points) points.textContent = 'Level ' + (player.level || 1) + ' · ' + (player.credits || 0) + 'c · Skill Points: ' + (player.skillPoints || 0) + ' · ' + zoneName;
  }
  function showToast(message, duration = 4500) {
    archiveToast.textContent = message;
    archiveToast.classList.add('visible');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => archiveToast.classList.remove('visible'), duration);
  }
  function renderBadge() {
    if (!chatBadge) return;
    chatBadge.textContent = unreadChat > 99 ? '99+' : String(unreadChat);
    chatBadge.classList.toggle('hidden', unreadChat <= 0 || chatOpen);
  }
  function setChatOpen(open) {
    chatOpen = !!open;
    if (chatPanel) chatPanel.classList.toggle('hidden', !chatOpen);
    if (chatToggle) {
      chatToggle.classList.toggle('open', chatOpen);
      chatToggle.setAttribute('aria-expanded', String(chatOpen));
    }
    if (chatOpen) {
      unreadChat = 0; renderBadge();
      if (chatList) chatList.scrollTop = chatList.scrollHeight;
    } else if (document.activeElement === chatInput) chatInput.blur();
  }
  function toggleChat(forceOpen) {
    if (!joined) return;
    setChatOpen(typeof forceOpen === 'boolean' ? forceOpen : !chatOpen);
  }
  function closeChatActions() {
    chatTarget = null;
    chatActions?.classList.add('hidden');
  }
  function handleBack() {
    if (chatActions && !chatActions.classList.contains('hidden')) { closeChatActions(); return; }
    if (title && !title.classList.contains('hidden')) return;
    if (arenaPanel && !arenaPanel.classList.contains('hidden')) { hideArena(); return; }
    if (shopPanel && !shopPanel.classList.contains('hidden')) { hideShop(); return; }
    if (menuController.isOpen()) { menuController.close(); return; }
    if (currentInvite) {
      actions.respondParty(currentInvite.inviteId, false);
      currentInvite = null; inviteToast?.classList.add('hidden'); return;
    }
    if (chatOpen) toggleChat(false);
  }
  function renderGiftChoices() {
    if (!chatTarget || !chatActionsList) return;
    const player = actions.getPlayer?.();
    const items = (player?.inventory || []).filter((id) => ITEM_CATALOG[id]);
    if (!items.length) {
      const note = document.createElement('p'); note.className = 'chat-action-note';
      note.textContent = 'No giftable items in your inventory.';
      chatActionsList.append(note);
      return;
    }
    const heading = document.createElement('div'); heading.className = 'chat-action-heading'; heading.textContent = 'SEND A GIFT';
    chatActionsList.append(heading);
    for (const id of items) {
      const item = ITEM_CATALOG[id];
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'chat-action';
      button.textContent = item.name;
      button.addEventListener('click', () => {
        actions.sendGift?.(chatTarget.id, id);
        closeChatActions();
      });
      chatActionsList.append(button);
    }
  }
  function renderChatActions() {
    if (!chatActionsList || !chatTarget) return;
    chatActionsList.replaceChildren();
    const add = document.createElement('button');
    add.type = 'button'; add.className = 'chat-action'; add.textContent = 'ADD FRIEND';
    add.addEventListener('click', () => { actions.addFriend?.(chatTarget.id, chatTarget.name); closeChatActions(); });
    const invite = document.createElement('button');
    invite.type = 'button'; invite.className = 'chat-action'; invite.textContent = 'INVITE TO PARTY';
    invite.addEventListener('click', () => { actions.invitePlayer?.(chatTarget.id); closeChatActions(); });
    const gift = document.createElement('button');
    gift.type = 'button'; gift.className = 'chat-action'; gift.textContent = 'SEND A GIFT';
    gift.addEventListener('click', () => { chatActionsList.replaceChildren(); renderGiftChoices(); });
    chatActionsList.append(add, invite, gift);
  }
  function openChatActions(playerId, name, event) {
    if (!chatActions || !chatActionsList) return;
    chatTarget = { id: playerId, name: name || 'Operative' };
    chatActionsName.textContent = chatTarget.name;
    renderChatActions();
    chatActions.classList.remove('hidden');
    const width = 210, x = Math.max(8, Math.min(window.innerWidth - width - 8, (event?.clientX || window.innerWidth / 2) - width / 2));
    const y = Math.max(8, Math.min(window.innerHeight - 150, (event?.clientY || window.innerHeight / 2) + 10));
    chatActions.style.left = x + 'px'; chatActions.style.top = y + 'px';
  }
  function appendChat(message, system = false) {
    const item = document.createElement('li');
    if (system) { item.className = 'chat-system'; item.textContent = message; }
    else {
      const channel = document.createElement('span'); channel.className = 'chat-channel';
      channel.textContent = '[' + String(message.channel || 'global').toUpperCase() + '] ';
      const name = document.createElement('button');
      name.type = 'button'; name.className = 'chat-name';
      name.textContent = String(message.name || 'Operative') + ': ';
      name.addEventListener('click', (event) => { event.stopPropagation(); openChatActions(message.playerId, message.name, event); });
      const text = document.createElement('span'); text.textContent = String(message.text || '');
      item.append(channel, name, text);
    }
    chatList.appendChild(item);
    while (chatList.children.length > 60) chatList.firstElementChild.remove();
    chatList.scrollTop = chatList.scrollHeight;
    if (!chatOpen && !system) { unreadChat += 1; renderBadge(); }
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
    const colors = { wind: '#00ff88', water: '#0088ff', fire: '#ff4400', earth: '#cc7722', dark: '#bd38f5' };
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
  function renderShop(payload) {
    shopPayload = payload;
    if (!shopItems) return;
    const credits = payload?.credits || 0;
    shopBalance.textContent = 'CREDITS: ' + credits + ' · BUY GEAR · SELL LOOT';
    shopItems.replaceChildren();
    const inventory = payload?.inventory || [];
    for (const item of payload?.items || []) {
      const owned = inventory.includes(item.id);
      const equipped = payload.equipped?.[item.slot] === item.id;
      const card = document.createElement('div'); card.className = 'shop-item' + (owned ? ' owned' : '');
      const copy = document.createElement('div');
      const title = document.createElement('strong'); title.textContent = item.name;
      const meta = document.createElement('small');
      meta.textContent = item.tier + ' · ' + item.slot.toUpperCase() + ' · ' + (item.atkBonus ? '+' + item.atkBonus + ' ATK · ' : '') + (item.price ? item.price + 'c' : 'FREE');
      const desc = document.createElement('p'); desc.textContent = item.desc;
      copy.append(title, meta, desc);
      const action = document.createElement('div');
      action.className = 'shop-actions';
      if (owned) {
        if (item.slot !== 'supply') {
          const equip = document.createElement('button'); equip.type = 'button'; equip.className = 'menu-action';
          equip.textContent = equipped ? 'EQUIPPED' : 'EQUIP';
          equip.disabled = equipped;
          equip.addEventListener('click', () => actions.equipItem?.(item.id));
          action.append(equip);
        }
        const sell = document.createElement('button'); sell.type = 'button'; sell.className = 'menu-action ghost';
        sell.textContent = 'SELL ' + (item.sell || 0) + 'c';
        sell.addEventListener('click', () => actions.sellItem?.(item.id));
        action.append(sell);
      } else {
        const button = document.createElement('button'); button.type = 'button'; button.className = 'menu-action';
        button.textContent = item.price > credits ? 'NEED ' + item.price : 'BUY';
        button.disabled = item.price > credits;
        button.addEventListener('click', () => actions.buyItem?.(item.id));
        action.append(button);
      }
      card.append(copy, action);
      shopItems.append(card);
    }
    if (shopStatus) shopStatus.textContent = '';
  }
  function showShop(payload) { renderShop(payload); shopPanel?.classList.remove('hidden'); }
  function hideShop() { shopPanel?.classList.add('hidden'); }

  function showArenaMenu(payload) {
    if (!arenaOptions) return;
    if (arenaTitle && payload?.name) arenaTitle.textContent = String(payload.name).toUpperCase();
    if (arenaNote && payload?.note) arenaNote.textContent = payload.note;
    arenaOptions.replaceChildren();
    for (const alignment of ['pvp', 'pve']) {
      const options = (payload?.options || []).filter((option) => option.alignment === alignment);
      if (!options.length) continue;
      const group = document.createElement('div'); group.className = 'arena-group';
      const heading = document.createElement('h3');
      heading.textContent = alignment === 'pvp' ? 'PLAYER VS PLAYER' : 'CO-OP / PLAYER VS ENEMY';
      group.append(heading);
      for (const option of options) {
        const button = document.createElement('button');
        button.type = 'button'; button.className = 'arena-option';
        button.textContent = option.name;
        const note = document.createElement('small');
        note.textContent = alignment === 'pvp' ? 'Open teams · friendly squad damage disabled' : 'No friendly fire · wardens join the match';
        button.append(note);
        button.addEventListener('click', () => {
          actions.enterArena?.(option.id);
          arenaPanel?.classList.add('hidden');
        });
        group.append(button);
      }
      arenaOptions.append(group);
    }
    arenaPanel?.classList.remove('hidden');
  }
  function hideArena() { arenaPanel?.classList.add('hidden'); }

  accountMode?.addEventListener('change', () => {
    const needsPassword = accountMode.value !== 'guest';
    passwordInput?.classList.toggle('hidden', !needsPassword);
    if (passwordInput) passwordInput.autocomplete = accountMode.value === 'register' ? 'new-password' : 'current-password';
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const name = nameInput.value.trim();
    if (!name) { nameError.textContent = 'Enter a character name or account username.'; return; }
    const mode = accountMode?.value || 'guest';
    if (mode !== 'guest' && !passwordInput?.value) { nameError.textContent = 'Enter your account password.'; return; }
    nameError.textContent = ''; enterButton.disabled = true;
    if (mode === 'guest') actions.join(name, selectedFaction, 'guest');
    else actions.authenticate(mode, name, passwordInput.value);
  });
  $('#menu-button')?.addEventListener('click', () => actions.toggleMenu());
  if (chatToggle) chatToggle.addEventListener('click', () => toggleChat());
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') { event.preventDefault(); handleBack(); return; }
    if (event.target && event.target.closest && event.target.closest('input, textarea')) return;
    if (event.key === 'Enter' && joined && !chatOpen && !menuController.isOpen()) { event.preventDefault(); toggleChat(true); chatInput.focus(); }
  });
  document.addEventListener('click', (event) => {
    if (!chatActions || chatActions.classList.contains('hidden')) return;
    if (!chatActions.contains(event.target)) closeChatActions();
  });
  $('#menu-close')?.addEventListener('click', () => menuController.close());
  document.querySelectorAll('.upgrade-button').forEach((button) => button.addEventListener('click', () => actions.upgrade(button.dataset.upgrade)));
  document.querySelectorAll('.color-option').forEach((button) => button.addEventListener('click', () => actions.selectDomain(button.dataset.color)));
  $('#party-leave')?.addEventListener('click', () => actions.leaveParty());
  document.querySelectorAll('.chat-tab').forEach((button) => button.addEventListener('click', () => selectChatChannel(button.dataset.chatChannel)));
  $('#chat-actions-close')?.addEventListener('click', closeChatActions);
  $('#shop-close')?.addEventListener('click', hideShop);
  shopPanel?.addEventListener('click', (event) => { if (event.target === shopPanel) hideShop(); });
  $('#arena-close')?.addEventListener('click', hideArena);
  arenaPanel?.addEventListener('click', (event) => { if (event.target === arenaPanel) hideArena(); });
  chatForm.addEventListener('submit', (event) => {
    event.preventDefault();
    let text = chatInput.value.trim(), channel = activeChannel;
    const command = text.match(/^\/(s|g|f)(?:\s+|$)(.*)$/i);
    if (command) { channel = ({ s: 'squad', g: 'global', f: 'faction' })[command[1].toLowerCase()]; text = command[2].trim(); }
    else if (text.startsWith('!')) { channel = 'global'; text = text.slice(1).trim(); }
    if (!text) return;
    actions.sendChat(channel, text); chatInput.value = '';
  });
  $('#party-accept')?.addEventListener('click', () => {
    if (currentInvite) actions.respondParty(currentInvite.inviteId, true);
    currentInvite = null; inviteToast.classList.add('hidden');
  });
  $('#party-decline')?.addEventListener('click', () => {
    if (currentInvite) actions.respondParty(currentInvite.inviteId, false);
    currentInvite = null; inviteToast.classList.add('hidden');
  });

  return {
    setStatus(message, connected) { status.textContent = message; status.classList.toggle('offline', !connected); },
    joinAccepted({ name, stats }) {
      joined = true; profile = { ...profile, name, ...stats }; saveProfile();
      if (DOMAINS[stats?.energyColor]) { selectedFaction = stats.energyColor; renderFactions(); }
      title.classList.add('hidden'); enterButton.disabled = false; nameError.textContent = '';
      status.textContent = 'CONNECTED';
      status.classList.remove('offline');
      showToast('Welcome to the First Village, ' + name + '. The road east is waiting.', 3000);
      unreadChat = 0; setChatOpen(false); renderBadge();
    },
    joinError(message) { nameError.textContent = message; enterButton.disabled = false; },
    authenticated({ username }) {
      if (passwordInput) passwordInput.value = '';
      actions.join(username, selectedFaction, 'account');
    },
    showArchiveToast: showToast,
    updatePlayer(player) {
      profile = {
        name: player.name, hp: player.hp, maxHp: player.maxHp, coreCharge: player.coreCharge,
        corePoints: player.corePoints, credits: player.credits, gearAtk: player.gearAtk,
        homeCity: player.homeCity, unlockedCities: player.unlockedCities, towers: player.towers,
        skillPoints: player.skillPoints, partyXp: player.partyXp,
        atk: player.atk, plating: player.plating, overclock: player.overclock, energyColor: player.energyColor,
        palette: player.palette,
        inventory: player.inventory, equipped: player.equipped, skills: player.skills, friends: player.friends
      };
      if (player.energyColor && DOMAINS[player.energyColor] && player.energyColor !== selectedFaction) {
        selectedFaction = player.energyColor;
        renderFactions();
      }
      saveProfile(); updateMenu(player);
      // Menu pages read the live snapshot. Rebuild them only when skills,
      // gear, points or resources actually change — not on every tick — so a
      // tap on a skill node is not swallowed by a constant re-render.
      const signature = [player.level, player.skillPoints, player.xp, player.credits, player.gearAtk, player.atk, player.plating, player.overclock, player.energyColor, player.palette, Math.ceil(player.hp || 0), (player.inventory || []).length, JSON.stringify(player.equipped || {}), JSON.stringify(player.skills || {})].join('|');
      if (signature !== menuSignature) {
        menuSignature = signature;
        if (menuController.isOpen()) menuController.refresh();
      }
      if (player.abilityShort) {
        abilityButton.textContent = player.abilityShort;
        abilityButton.setAttribute('aria-label', 'Cast ' + (player.abilityName || 'sleeve ability'));
      }
      abilityButton.dataset.ready = player.abilityCooldown > 0 ? 'false' : 'true';
      if (menuController.isOpen() && shopPayload) renderShop({ ...shopPayload, credits: player.credits || 0, inventory: player.inventory || [], equipped: player.equipped || {}, gearAtk: player.gearAtk || 0 });
    },
    setInputMode(mode) {
      document.body.dataset.inputMode = mode;
      if (mode === 'keyboard') hints.innerHTML = '<span class="control-badge">WASD / ↑↓←→</span> Move &nbsp; <span class="control-badge">SPACE</span> Blast<br /><span class="control-badge">SHIFT</span> Dash &nbsp; <span class="control-badge">E</span> Shield &nbsp; <span class="control-badge">Q</span> Sleeve<br /><span class="control-badge">F</span> Interact &nbsp; <span class="control-badge">C</span> Menu &nbsp; <span class="control-badge">+ / −</span> Zoom';
      else if (mode === 'controller') hints.innerHTML = '<span class="control-badge">STICK / D-PAD</span> Move / Navigate &nbsp; <span class="control-badge">A</span> Select / Interact<br /><span class="control-badge">RT</span> Blast &nbsp; <span class="control-badge">B</span> Dash / Back &nbsp; <span class="control-badge">Y</span> Shield<br /><span class="control-badge">X / RB</span> Sleeve Ability &nbsp; <span class="control-badge">START / SELECT</span> Menu';
      else hints.textContent = '';
    },
    toggleMenu(forceOpen) { menuController.toggle(forceOpen); },
    toggleMenuFromInput(forceOpen) { menuController.toggle(forceOpen); },
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
    zoneChanged(payload) {
      const zone = payload?.zone || {};
      const kind = zone.kind || (payload?.arena ? 'arena' : 'wild');
      let message;
      if (kind === 'arena') message = 'Entering ' + (zone.name || 'the arena') + ' — combat live.';
      else if (kind === 'haven') message = 'Entering ' + (zone.name || 'a safe city') + ' — no combat.';
      else if (kind === 'tower') message = 'Entering ' + (zone.name || 'the tower') + ' — waves incoming.';
      else message = 'Entering ' + (zone.name || 'the wilderness') + (zone.levelBand ? ' — enemies LV ' + zone.levelBand[0] + '–' + zone.levelBand[1] : '') + '.';
      showToast(message, 3200);
      if (menuController.isOpen()) menuController.refresh();
    },
    hubState() { if (menuController.isOpen()) menuController.refresh(); },
    worldMapChanged() { if (menuController.isOpen()) menuController.refresh(); },
    towersChanged() {},
    towerUnlocked(tower) { showToast('Tower online: ' + (tower?.name || 'regional tower') + '.', 4200); },
    showShop,
    showArenaMenu,
    shopUpdate: renderShop,
    shopError(message) { if (shopStatus) shopStatus.textContent = message; showToast(message, 3200); },
    friendsChanged() { if (menuController.isOpen()) menuController.refresh(); },
    inboxChanged() { if (menuController.isOpen()) menuController.refresh(); },
    skillUpdated(payload) { showToast((payload?.name || 'Sleeve node') + ' unlocked.', 3000); if (menuController.isOpen()) menuController.refresh(); },
    notice(message) { showToast(message, 3200); },
    giftSent(payload) { showToast('Gift sent to ' + payload.targetName + ': ' + payload.itemName + '.', 3200); },
    renderZones(zones, selectedId) {
      const options = $('#zone-options');
      if (!options) return;
      const focusedZone = options.contains(document.activeElement) ? document.activeElement.dataset.zone : null;
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
      if (focusedZone) options.querySelector('[data-zone="' + focusedZone + '"]')?.focus();
    }
  };
}

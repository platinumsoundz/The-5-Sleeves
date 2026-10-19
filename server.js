const path = require('path');
const fs = require('fs');
const express = require('express');
const { Server } = require('socket.io');

const app = express();
const httpServer = require('http').createServer(app);
const io = new Server(httpServer);
const PORT = process.env.PORT || 3000;
const WORLD = { width: 1000, height: 700 };
const CORE = { x: WORLD.width / 2, y: WORLD.height / 2, radius: 90 };
const PERIMETER_MARGIN = 40;
const MAX_ARCHIVE_ECHOES = 5;
const ARCHIVE_LOGS = [
  'Archive Log #04: Tower 1 atmospheric filters operating at 42% capacity...',
  'Archive Log #11: Ashley reports a repeating signal beneath the eastern transit line.',
  'Archive Log #17: Perimeter fog readings exceed safe exposure limits.',
  'Archive Log #23: The Cipher Conduit responds to Sleeve resonance.',
  'Archive Log #31: Evacuation records end before the final Tower 1 lockdown.'
];
const SLEEVE_COLORS = {
  cipher: '#00ffff',
  wind: '#00ff88',
  water: '#0088ff',
  fire: '#ff4400',
  earth: '#cc7722',
  dark: '#9900ff',
  azure: '#43b9ff',
  emerald: '#45f29a',
  crimson: '#ff536b',
  violet: '#c875ff'
};
const SLEEVE_ACCENTS = { cipher: '#78ff5f', wind: '#a7ffd0', water: '#71d5ff', fire: '#ffb347', earth: '#f0b768', dark: '#ff29d6', azure: '#8ce0ff', emerald: '#a7ffd0', crimson: '#ffb347', violet: '#ff29d6' };
const LEGACY_DOMAINS = { azure: 'water', emerald: 'wind', crimson: 'fire', violet: 'dark' };
const ACTIVE_DOMAINS = new Set(['cipher', 'wind', 'water', 'fire', 'earth', 'dark']);
const PROFILE_FILE = path.join(__dirname, 'player-profiles.json');
const players = {};
const playerSockets = {};
const projectiles = {};
const archiveEchoes = {};
const parties = {};
const playerParties = {};
const pendingPartyInvites = {};
let nextEchoId = 1;
let profiles = {};
let nextProjectileId = 1;
let lastTick = Date.now();
let lastProfileSave = Date.now();

try {
  profiles = JSON.parse(fs.readFileSync(PROFILE_FILE, 'utf8'));
  if (!profiles || typeof profiles !== 'object' || Array.isArray(profiles)) profiles = {};
} catch (error) {
  if (error.code !== 'ENOENT') console.error('Could not load player profiles:', error.message);
  profiles = {};
}

function saveProfiles() {
  const tempFile = PROFILE_FILE + '.tmp';
  try {
    fs.writeFileSync(tempFile, JSON.stringify(profiles, null, 2));
    fs.renameSync(tempFile, PROFILE_FILE);
  } catch (error) {
    console.error('Could not save player profiles:', error.message);
    try { fs.unlinkSync(tempFile); } catch (_) {}
  }
}

app.use(express.static(path.join(__dirname, 'public')));
app.get('/health', (_request, response) => response.json({ status: 'ok', players: Object.keys(players).length }));
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function broadcastState() {
  io.emit('players', players);
  io.emit('projectiles', projectiles);
}
function broadcastEchoes() { io.emit('archive:echoes', archiveEchoes); }
function partySnapshot(party) {
  if (!party) return null;
  return {
    id: party.id,
    leaderId: party.leaderId,
    members: party.members.map((id) => players[id]).filter(Boolean).map((member) => ({
      id: member.id, name: member.name, hp: member.hp, maxHp: member.maxHp,
      x: member.x, y: member.y, energyColor: member.energyColor, partyXp: member.partyXp
    }))
  };
}
function broadcastParty(partyId) {
  const party = parties[partyId];
  if (!party) return;
  const snapshot = partySnapshot(party);
  for (const memberId of party.members) playerSockets[memberId]?.emit('party:state', snapshot);
}
function removePartyMember(playerId) {
  const partyId = playerParties[playerId];
  if (!partyId) return;
  const party = parties[partyId];
  delete playerParties[playerId];
  playerSockets[playerId]?.leave('party:' + partyId);
  if (!party) return;
  party.members = party.members.filter((id) => id !== playerId);
  if (party.members.length <= 1) {
    for (const remainingId of party.members) {
      delete playerParties[remainingId];
      playerSockets[remainingId]?.leave('party:' + partyId);
      playerSockets[remainingId]?.emit('party:state', null);
    }
    delete parties[partyId];
  } else {
    if (party.leaderId === playerId) party.leaderId = party.members[0];
    broadcastParty(partyId);
  }
  playerSockets[playerId]?.emit('party:state', null);
}
function awardNearbyParty(player) {
  const party = parties[playerParties[player.id]];
  if (!party) return;
  let changed = false;
  for (const memberId of party.members) {
    if (memberId === player.id) continue;
    const member = players[memberId];
    if (!member || distance(player, member) > 260) continue;
    member.partyXp = Math.round((member.partyXp + 0.25) * 100) / 100;
    member.coreCharge = Math.min(99.99, member.coreCharge + 5);
    playerSockets[memberId]?.emit('party:reward', { source: player.name, partyXp: member.partyXp, coreCharge: member.coreCharge });
    persistPlayer(member);
    changed = true;
  }
  if (changed) broadcastParty(party.id);
}
function spawnArchiveEcho() {
  const columns = Math.floor(WORLD.width / 40);
  const rows = Math.floor(WORLD.height / 40);
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const x = (1 + Math.floor(Math.random() * (columns - 2))) * 40 + 20;
    const y = (1 + Math.floor(Math.random() * (rows - 2))) * 40 + 20;
    if (distance({ x, y }, CORE) < 150) continue;
    if (Object.values(archiveEchoes).some((echo) => distance(echo, { x, y }) < 70)) continue;
    const id = 'echo-' + nextEchoId++;
    archiveEchoes[id] = { id, x, y, loreIndex: (nextEchoId - 2) % ARCHIVE_LOGS.length };
    return true;
  }
  return false;
}
function collectArchiveEchoes(player) {
  if (!player || player.hp <= 0) return false;
  let collected = false;
  for (const [id, echo] of Object.entries(archiveEchoes)) {
    if (distance(player, echo) > 25) continue;
    delete archiveEchoes[id];
    player.skillPoints += 1;
    player.coreCharge = Math.min(99.99, player.coreCharge + 15);
    playerSockets[player.id]?.emit('archive:collected', {
      echoId: id,
      lore: ARCHIVE_LOGS[echo.loreIndex] || ARCHIVE_LOGS[0],
      skillPoints: player.skillPoints,
      coreCharge: player.coreCharge
    });
    awardNearbyParty(player);
    collected = true;
  }
  if (collected) persistPlayer(player);
  return collected;
}
function validDirection(direction) {
  if (!direction || !Number.isFinite(direction.x) || !Number.isFinite(direction.y)) return null;
  const length = Math.hypot(direction.x, direction.y);
  return length > 0.01 ? { x: direction.x / length, y: direction.y / length } : null;
}
for (let i = 0; i < MAX_ARCHIVE_ECHOES; i += 1) spawnArchiveEcho();

function persistPlayer(player) {
  if (!player) return;
  profiles[player.name.toLowerCase()] = {
    name: player.name,
    corePoints: player.corePoints,
    coreCharge: player.coreCharge,
    hp: player.hp,
    maxHp: player.maxHp,
    atk: player.atk,
    plating: player.plating,
    overclock: player.overclock,
    skillPoints: player.skillPoints,
    partyXp: player.partyXp,
    energyColor: player.energyColor,
    updatedAt: new Date().toISOString()
  };
  saveProfiles();
}

io.on('connection', (socket) => {
  let player = null;
  console.log('Client connected: ' + socket.id);
  socket.emit('server:welcome', { message: 'Connected to The 5 Sleeves Online.', playerId: socket.id, world: WORLD, core: CORE });
  socket.emit('archive:echoes', archiveEchoes);
  socket.emit('party:state', null);

  socket.on('player:join', (requestedName) => {
    if (player) return;
    if (typeof requestedName !== 'string') {
      socket.emit('name_error', { message: 'Enter a character name.' });
      return;
    }
    const name = requestedName.trim().replace(/\s+/g, ' ');
    if (name.length < 2 || name.length > 18 || !/^[\p{L}\p{N}_ -]+$/u.test(name)) {
      socket.emit('name_error', { message: 'Use 2–18 letters, numbers, spaces, _ or -.' });
      return;
    }
    const nameKey = name.toLowerCase();
    const isTaken = Object.values(players).some((activePlayer) => activePlayer.name.toLowerCase() === nameKey);
    if (isTaken) {
      socket.emit('name_taken', { message: 'Name already taken! Choose another name.' });
      return;
    }

    const profile = profiles[nameKey] || {};
    player = {
      id: socket.id,
      name,
      x: 100 + Math.random() * (WORLD.width - 200),
      y: 100 + Math.random() * (WORLD.height - 200),
      energyColor: Object.hasOwn(SLEEVE_COLORS, profile.energyColor)
        ? (LEGACY_DOMAINS[profile.energyColor] || profile.energyColor)
        : 'cipher',
      color: SLEEVE_COLORS[Object.hasOwn(SLEEVE_COLORS, profile.energyColor)
        ? (LEGACY_DOMAINS[profile.energyColor] || profile.energyColor)
        : 'cipher'],
      accentColor: SLEEVE_ACCENTS[Object.hasOwn(SLEEVE_COLORS, profile.energyColor)
        ? (LEGACY_DOMAINS[profile.energyColor] || profile.energyColor)
        : 'cipher'],
      atk: Number.isInteger(profile.atk) ? clamp(profile.atk, 0, 99) : 0,
      plating: Number.isInteger(profile.plating) ? clamp(profile.plating, 0, 99) : 0,
      overclock: Number.isInteger(profile.overclock) ? clamp(profile.overclock, 0, 99) : 0,
      skillPoints: Number.isInteger(profile.skillPoints) ? Math.max(0, profile.skillPoints) : 0,
      partyXp: Number.isFinite(profile.partyXp) ? Math.max(0, profile.partyXp) : 0,
      hp: Number.isFinite(profile.hp) ? clamp(profile.hp, 1, Number.isFinite(profile.maxHp) ? profile.maxHp : 100) : 100,
      maxHp: Number.isFinite(profile.maxHp) ? clamp(profile.maxHp, 100, 1585) : 100,
      shieldUntil: 0,
      coreCharge: Number.isFinite(profile.coreCharge) ? clamp(profile.coreCharge, 0, 99.99) : 0,
      corePoints: Number.isFinite(profile.corePoints) ? Math.max(0, profile.corePoints) : 0,
      inCore: false,
      lastAttackAt: 0,
      lastDashAt: 0,
      lastShieldAt: 0
    };
    players[socket.id] = player;
    playerSockets[player.id] = socket;
    socket.emit('join:accepted', { playerId: player.id, name: player.name, stats: { hp: player.hp, maxHp: player.maxHp, coreCharge: player.coreCharge, corePoints: player.corePoints, skillPoints: player.skillPoints, partyXp: player.partyXp, atk: player.atk, plating: player.plating, overclock: player.overclock, energyColor: player.energyColor } });
    broadcastState();
    console.log('Operative joined: ' + player.name + ' (' + socket.id + ')');
  });

  socket.on('player:move', (position) => {
    if (!player || !position || !Number.isFinite(position.x) || !Number.isFinite(position.y) || player.hp <= 0) return;
    player.x = clamp(position.x, PERIMETER_MARGIN, WORLD.width - PERIMETER_MARGIN);
    player.y = clamp(position.y, PERIMETER_MARGIN, WORLD.height - PERIMETER_MARGIN);
  });
  socket.on('player:upgrade', (stat) => {
    if (!player || player.skillPoints <= 0) return;
    if (!['atk', 'plating', 'overclock'].includes(stat) || player[stat] >= 99) return;
    player.skillPoints -= 1;
    player[stat] += 1;
    if (stat === 'plating') {
      player.maxHp = Math.min(1585, player.maxHp + 15);
      player.hp = Math.min(player.maxHp, player.hp + 15);
    }
    persistPlayer(player);
    broadcastState();
  });

  socket.on('player:color', (colorKey) => {
    if (!player || !ACTIVE_DOMAINS.has(colorKey)) return;
    player.energyColor = colorKey;
    player.color = SLEEVE_COLORS[colorKey];
    player.accentColor = SLEEVE_ACCENTS[colorKey];
    persistPlayer(player);
    broadcastState();
  });

  socket.on('party:invite:send', (targetId) => {
    if (!player || typeof targetId !== 'string' || targetId === player.id) return;
    const target = players[targetId];
    if (!target || distance(player, target) > 200) {
      socket.emit('party:error', 'That operative is not nearby.');
      return;
    }
    if (playerParties[targetId]) {
      socket.emit('party:error', 'That operative is already in a squad.');
      return;
    }
    const partyId = playerParties[player.id] || 'squad-' + player.id;
    const party = parties[partyId];
    if (party && party.members.length >= 4) {
      socket.emit('party:error', 'Your squad is full (4 operatives maximum).');
      return;
    }
    const inviteId = partyId + ':' + targetId + ':' + Date.now();
    pendingPartyInvites[targetId] = { inviteId, partyId, inviterId: player.id, expiresAt: Date.now() + 30000 };
    playerSockets[targetId]?.emit('party:invite', { inviteId, inviterId: player.id, inviterName: player.name, expiresIn: 30 });
    socket.emit('party:invite:sent', { targetName: target.name });
  });

  socket.on('party:respond', (response) => {
    const invite = pendingPartyInvites[socket.id];
    if (!player || !invite || !response || response.inviteId !== invite.inviteId || Date.now() > invite.expiresAt) {
      delete pendingPartyInvites[socket.id];
      socket.emit('party:error', 'That squad invite expired.');
      return;
    }
    delete pendingPartyInvites[socket.id];
    const inviter = players[invite.inviterId];
    if (!response.accept) {
      playerSockets[invite.inviterId]?.emit('party:notice', player.name + ' declined your squad invite.');
      return;
    }
    if (!inviter || playerParties[player.id]) {
      socket.emit('party:error', 'You or the inviter can no longer join this squad.');
      return;
    }
    let party = parties[invite.partyId];
    if (!party) {
      if (playerParties[inviter.id]) {
        socket.emit('party:error', 'That squad invite is no longer valid.');
        return;
      }
      party = { id: invite.partyId, leaderId: inviter.id, members: [inviter.id] };
      parties[party.id] = party;
      playerParties[inviter.id] = party.id;
      playerSockets[inviter.id]?.join('party:' + party.id);
    }
    if (!party.members.includes(inviter.id) || party.members.length >= 4) {
      socket.emit('party:error', 'That squad is full or no longer available.');
      return;
    }
    party.members.push(player.id);
    playerParties[player.id] = party.id;
    socket.join('party:' + party.id);
    broadcastParty(party.id);
    playerSockets[inviter.id]?.emit('party:notice', player.name + ' joined your squad.');
  });

  socket.on('party:leave', () => {
    if (player) removePartyMember(player.id);
  });

  socket.on('chat:send', (payload) => {
    if (!player || !payload || typeof payload.text !== 'string') return;
    const text = payload.text.replace(/[\\u0000-\\u001f\\u007f]/g, ' ').trim().slice(0, 240);
    const channel = payload.channel;
    if (!text) return;
    if (!['global', 'squad', 'faction'].includes(channel)) {
      socket.emit('chat:error', 'Choose Global, Squad, or Faction chat.');
      return;
    }
    const message = { channel, playerId: player.id, name: player.name, faction: player.energyColor, text, time: Date.now() };
    if (channel === 'global') io.emit('chat:message', message);
    else if (channel === 'squad') {
      const party = parties[playerParties[player.id]];
      if (!party) { socket.emit('chat:error', 'Join a squad before using Squad chat.'); return; }
      for (const memberId of party.members) playerSockets[memberId]?.emit('chat:message', message);
    } else {
      for (const factionPlayer of Object.values(players)) {
        if (factionPlayer.energyColor === player.energyColor) playerSockets[factionPlayer.id]?.emit('chat:message', message);
      }
    }
  });

  socket.on('player:attack', (direction) => {
    if (!player) return;
    const aim = validDirection(direction);
    const now = Date.now();
    if (!aim || player.hp <= 0 || now - player.lastAttackAt < 450) return;
    player.lastAttackAt = now;
    const id = String(nextProjectileId++);
    projectiles[id] = { id, ownerId: player.id, x: player.x + aim.x * 22, y: player.y + aim.y * 22, vx: aim.x * 520, vy: aim.y * 520, radius: 9, expiresAt: now + 1100, color: player.color, accentColor: player.accentColor };
  });
  socket.on('player:dash', (direction) => {
    if (!player) return;
    const aim = validDirection(direction);
    const now = Date.now();
    if (!aim || player.hp <= 0 || now - player.lastDashAt < Math.max(250, 1300 * Math.pow(0.9, player.overclock))) return;
    player.lastDashAt = now;
    player.x = clamp(player.x + aim.x * 120, PERIMETER_MARGIN, WORLD.width - PERIMETER_MARGIN);
    player.y = clamp(player.y + aim.y * 120, PERIMETER_MARGIN, WORLD.height - PERIMETER_MARGIN);
    socket.emit('player:position', { x: player.x, y: player.y });
  });
  socket.on('player:shield', () => {
    if (!player) return;
    const now = Date.now();
    if (player.hp <= 0 || now - player.lastShieldAt < Math.max(500, 4000 * Math.pow(0.9, player.overclock))) return;
    player.lastShieldAt = now;
    player.shieldUntil = now + 1800;
  });
  socket.on('disconnect', (reason) => {
    if (player) {
      persistPlayer(player);
      removePartyMember(socket.id);
      delete pendingPartyInvites[socket.id];
      for (const [targetId, invite] of Object.entries(pendingPartyInvites)) {
        if (invite.inviterId === socket.id) {
          delete pendingPartyInvites[targetId];
          playerSockets[targetId]?.emit('party:error', 'The inviter left the Conduit.');
        }
      }
      delete players[socket.id];
      delete playerSockets[socket.id];
      broadcastState();
      console.log('Operative disconnected: ' + player.name + ' (' + reason + ')');
    } else {
      console.log('Unjoined client disconnected: ' + socket.id + ' (' + reason + ')');
    }
  });
});

setInterval(() => {
  const now = Date.now();
  const deltaSeconds = Math.min((now - lastTick) / 1000, 0.1);
  lastTick = now;

  let echoesChanged = false;
  for (const player of Object.values(players)) {
    player.inCore = player.hp > 0 && distance(player, CORE) <= CORE.radius;
    if (collectArchiveEchoes(player)) echoesChanged = true;
    if (player.inCore) {
      player.coreCharge += deltaSeconds * 25;
      if (player.coreCharge >= 100) {
        player.coreCharge -= 100;
        player.corePoints += 1;
        player.skillPoints += 1;
        awardNearbyParty(player);
      }
    } else {
      player.coreCharge = Math.max(0, player.coreCharge - deltaSeconds * 10);
    }
  }
  for (const [id, projectile] of Object.entries(projectiles)) {
    projectile.x += projectile.vx * deltaSeconds;
    projectile.y += projectile.vy * deltaSeconds;
    let hit = false;
    for (const target of Object.values(players)) {
      if (target.id === projectile.ownerId || target.hp <= 0 || distance(target, projectile) > 21) continue;
      target.hp = Math.max(0, target.hp - (now < target.shieldUntil ? 8 : 20 + 3 * (players[projectile.ownerId]?.atk || 0)));
      delete projectiles[id];
      hit = true;
      break;
    }
    if (!hit && (now > projectile.expiresAt || projectile.x < 0 || projectile.x > WORLD.width || projectile.y < 0 || projectile.y > WORLD.height)) delete projectiles[id];
  }
  if (echoesChanged) broadcastEchoes();
  if (now - lastProfileSave >= 10000 && Object.keys(players).length > 0) {
    for (const player of Object.values(players)) {
      profiles[player.name.toLowerCase()] = {
        name: player.name,
        corePoints: player.corePoints,
        coreCharge: player.coreCharge,
        hp: player.hp,
        maxHp: player.maxHp,
        atk: player.atk,
        plating: player.plating,
        overclock: player.overclock,
        skillPoints: player.skillPoints,
        partyXp: player.partyXp,
        energyColor: player.energyColor,
        updatedAt: new Date().toISOString()
      };
    }
    saveProfiles();
    lastProfileSave = now;
  }
  broadcastState();
}, 50);

setInterval(() => {
  if (Object.keys(archiveEchoes).length < MAX_ARCHIVE_ECHOES && spawnArchiveEcho()) broadcastEchoes();
}, 7000);

httpServer.listen(PORT, '0.0.0.0', () => console.log('The 5 Sleeves server is running at http://localhost:' + PORT));

// The 5 Sleeves server — host only. Per-zone gameplay lives in server/sim/*
// (one simulation per canon zone, see server/zones-catalog.js). This file
// owns: express, sockets, the lobby, zone registry, squads, chat, profiles
// and the plug-and-play module loader. See memory/03-module-architecture.md.
const path = require('path');
const fs = require('fs');
const express = require('express');
const { Server } = require('socket.io');

const app = express();
const httpServer = require('http').createServer(app);
const io = new Server(httpServer);
const PORT = process.env.PORT || 3000;

const { zoneCatalog, DEFAULT_ZONE_ID, LOBBY_ZONE_IDS, worldMapPayload } = require('./server/zones-catalog.js');
const { createSimulation } = require('./server/sim/state.js');
const { stepZone, seedZone } = require('./server/sim/index.js');
const { spawnWarden } = require('./server/sim/wardens.js');
const { abilityFor, castAbility } = require('./server/sim/abilities.js');
const { distance, inSafeZone } = require('./server/sim/combat.js');
const {
  SLEEVE_COLORS, SLEEVE_ACCENTS, LEGACY_DOMAINS, ACTIVE_DOMAINS,
  MAX_WARDENS, LEVEL_HP_GAIN
} = require('./server/sim/spec.js');
const { gearAtkFor } = require('./server/shop-catalog.js');
const { skillBonuses } = require('./server/skill-tree.js');
const { levelFromXp } = require('./server/progression.js');

// PROFILE_FILE lets the test suite point profiles at a throwaway file, so
// persisted credits/HP/XP from an earlier run can never leak into a fresh
// operative. Production leaves it unset and uses the normal file.
const PROFILE_FILE = process.env.PROFILE_FILE
  ? path.resolve(process.env.PROFILE_FILE)
  : path.join(__dirname, 'player-profiles.json');
// Tuning knob: scales every XP award (useful for fast progression on small servers).
const XP_SCALE = Number.isFinite(Number(process.env.XP_SCALE)) ? Math.max(0, Number(process.env.XP_SCALE)) : 1;
const SCORE_LIMIT = Number.isFinite(Number(process.env.SCORE_LIMIT)) ? Math.max(1, Number(process.env.SCORE_LIMIT)) : 400;

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function validDirection(direction) {
  if (!direction || !Number.isFinite(direction.x) || !Number.isFinite(direction.y)) return null;
  const length = Math.hypot(direction.x, direction.y);
  return length > 0.01 ? { x: direction.x / length, y: direction.y / length } : null;
}

// ---- Profiles (progression survives restarts) ------------------------------
let profiles = {};
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
const playersById = {}; // every joined player across every zone
app.get('/health', (_request, response) => response.json({ status: 'ok', players: Object.keys(playersById).length }));
// Plug-and-play client modules: the server scans public/src/modules on each
// request, so dropping a new module file in takes effect on a page refresh.
const CLIENT_MODULES_DIR = path.join(__dirname, 'public', 'src', 'modules');
app.get('/api/client-modules', (_request, response) => {
  let names = [];
  try {
    names = fs.readdirSync(CLIENT_MODULES_DIR).filter((file) => file.endsWith('.js')).map((file) => file.replace(/\.js$/, '')).sort();
  } catch (_) { /* no modules yet */ }
  response.json({ modules: names });
});

// ---- Zone registry: one simulation per world room -------------------------
const playerSockets = {}; // socketId -> socket (zones only own the player object)
const zones = {}; // zone id -> simulation
const CATALOG = zoneCatalog();
const HAVEN_IDS = new Set(CATALOG.filter((zone) => zone.kind === 'haven').map((zone) => zone.id));
const zoneOrder = LOBBY_ZONE_IDS.slice(); // title-screen choices (start village only)

function hostServices() {
  return {
    io,
    playerSockets,
    scoreLimit: SCORE_LIMIT,
    refreshLevelFields,
    applyXp,
    awardNearbyParty,
    persistPlayer,
    sameParty,
    travel: (player, zoneId, entry = 'center') => {
      const next = zones[zoneId];
      const socket = playerSockets[player?.id];
      if (player && next && socket) movePlayerToZone(player, socket, next, entry);
    }
  };
}

for (const catalogZone of CATALOG) {
  const sim = createSimulation(catalogZone, hostServices());
  zones[sim.id] = sim;
  if (sim.kind === 'wild') for (let i = 0; i < MAX_WARDENS; i += 1) spawnWarden(sim);
  if (sim.kind === 'arena' && sim.alignment === 'pve') {
    for (let i = 0; i < Math.min(MAX_WARDENS, 3); i += 1) spawnWarden(sim, { tier: 2 });
  }
  if (sim.kind !== 'haven' && sim.kind !== 'tower') seedZone(sim);
}
const DEFAULT_ZONE = zones[DEFAULT_ZONE_ID];
function playerZone(player) { return player ? zones[player.zoneId] || null : null; }
function lobbyPayload() {
  return zoneOrder.map((id) => ({ id, name: zones[id].name, book: zones[id].book, spirit: zones[id].spirit, players: Object.keys(zones[id].players).length }));
}
function zoneMeta(zone) {
  return {
    id: zone.id, name: zone.name, book: zone.book, spirit: zone.spirit, tint: zone.tint, biome: zone.biome,
    kind: zone.kind, mode: zone.mode, arena: !!zone.arena, friendlyFire: zone.friendlyFire !== false,
    danger: zone.danger || 0, levelBand: zone.levelBand || null,
    towerIndex: zone.towerIndex || null, towerName: zone.towerName || zone.tower?.name || null,
    havenId: zone.havenId || null, exits: { ...(zone.exits || {}) },
    safe: zone.safe || null, tower: zone.tower || null,
    arenaMode: zone.arenaMode || null, alignment: zone.alignment || null
  };
}
function entrySpawn(zone, entry) {
  const base = zone.spawn || { x: zone.world.width / 2, y: zone.world.height / 2 };
  if (entry === 'west') return { x: 92, y: base.y };
  if (entry === 'east') return { x: zone.world.width - 92, y: base.y };
  if (entry === 'north') return { x: base.x, y: 92 };
  if (entry === 'south') return { x: base.x, y: zone.world.height - 92 };
  return { x: base.x, y: base.y };
}
const EDGE_ENTRY = { east: 'west', west: 'east', north: 'south', south: 'north' };
function canUseExit(player, zone, direction) {
  // Cities gate their east road behind the regional tower. The north gate is
  // always open so the player can go and clear it.
  if (zone.kind === 'haven' && direction === 'east' && zone.towerIndex && !player.towers?.[zone.towerIndex]) {
    return { ok: false, reason: 'Clear ' + (zone.towerName || zone.tower?.name || 'the regional tower') + ' before leaving the city.' };
  }
  return { ok: true };
}
function unlockHaven(player, zone, socket) {
  if (zone.kind !== 'haven') return;
  player.unlockedCities = Array.isArray(player.unlockedCities) ? player.unlockedCities : ['haven-perimeter'];
  const isNew = !player.unlockedCities.includes(zone.id);
  if (isNew) player.unlockedCities.push(zone.id);
  player.homeCity = zone.id;
  if (isNew) {
    socket?.emit('city:unlocked', { id: zone.id, name: zone.name, unlockedCities: player.unlockedCities });
    socket?.emit('hub:notice', 'Spawn point unlocked: ' + zone.name + '.');
  }
  persistPlayer(player);
}

// ---- Host services shared with every zone simulation -----------------------
function refreshLevelFields(player) {
  const progress = levelFromXp(player.xp);
  player.level = progress.level;
  player.xpIntoLevel = progress.into;
  player.xpNeeded = progress.needed;
}

// Single funnel for every XP source so levels, rewards and broadcasts stay in
// sync. Returns the number of levels gained.
function applyXp(player, amount) {
  if (!player || !Number.isFinite(amount) || amount <= 0) return 0;
  const award = amount * XP_SCALE;
  if (award <= 0) return 0;
  const before = levelFromXp(player.xp).level;
  player.xp = Math.round(player.xp + award);
  refreshLevelFields(player);
  const gained = player.level - before;
  if (gained > 0) {
    player.skillPoints += gained;
    player.maxHp = Math.min(1585, player.maxHp + LEVEL_HP_GAIN * gained);
    player.hp = Math.min(player.maxHp, player.hp + LEVEL_HP_GAIN * gained);
    (playerZone(player)?.send ?? io.emit.bind(io))('level:up', {
      playerId: player.id,
      name: player.name,
      level: player.level,
      maxHp: player.maxHp,
      skillPoints: player.skillPoints,
      color: player.color
    });
    awardNearbyParty(player);
  }
  persistPlayer(player);
  return gained;
}

// Writes a player's progress to the profile store. Modules extend the record
// through the 'persist' hook instead of editing this whitelist.
function persistPlayer(player, save = true) {
  if (!player) return;
  const record = {
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
    xp: player.xp,
    level: player.level,
    energyColor: player.energyColor,
    credits: Math.max(0, Math.round(player.credits || 0)),
    homeCity: player.homeCity || 'haven-perimeter',
    unlockedCities: Array.isArray(player.unlockedCities) ? player.unlockedCities : ['haven-perimeter'],
    towers: player.towers || {},
    updatedAt: new Date().toISOString()
  };
  hooks.emit('persist', player, record);
  profiles[player.name.toLowerCase()] = record;
  if (save) saveProfiles();
}

// ---- Operative Squads (global; members may be in different zones) ----------
const parties = {};
const playerParties = {};
const pendingPartyInvites = {};
// Squad mates never damage each other, regardless of zone mode.
function sameParty(firstId, secondId) {
  const partyId = playerParties[firstId];
  return !!partyId && partyId === playerParties[secondId];
}
function partySnapshot(party) {
  if (!party) return null;
  return {
    id: party.id,
    leaderId: party.leaderId,
    members: party.members.map((id) => playersById[id]).filter(Boolean).map((member) => ({
      id: member.id, name: member.name, hp: member.hp, maxHp: member.maxHp,
      x: member.x, y: member.y, energyColor: member.energyColor, partyXp: member.partyXp,
      zoneId: member.zoneId
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
// Squad assists only pay when both operatives share a zone AND stand close.
function awardNearbyParty(player) {
  const party = parties[playerParties[player.id]];
  if (!party) return;
  let changed = false;
  for (const memberId of party.members) {
    if (memberId === player.id) continue;
    const member = playersById[memberId];
    if (!member || member.zoneId !== player.zoneId || distance(player, member) > 260) continue;
    member.partyXp = Math.round((member.partyXp + 0.25) * 100) / 100;
    member.coreCharge = Math.min(99.99, member.coreCharge + 5);
    playerSockets[memberId]?.emit('party:reward', { source: player.name, partyXp: member.partyXp, coreCharge: member.coreCharge });
    persistPlayer(member);
    changed = true;
  }
  if (changed) broadcastParty(party.id);
}

// ---- Zone membership -------------------------------------------------------
// Moving between zones: leave the old room, join the new one, enter from the
// side the player used. Cities unlock their spawn point on first arrival.
function movePlayerToZone(player, socket, nextZone, entry = 'center') {
  const previous = playerZone(player);
  if (previous === nextZone) return;
  if (previous) {
    delete previous.players[player.id];
    previous.memberCount = Math.max(0, previous.memberCount - 1);
    socket.leave('zone:' + previous.id);
    previous.broadcast();
  }
  player.zoneId = nextZone.id;
  if (nextZone.kind === 'arena') {
    if (nextZone.alignment === 'pvp') {
      const counts = { blue: 0, red: 0 };
      for (const other of Object.values(nextZone.players)) {
        if (other.id !== player.id && counts[other.arenaTeam] !== undefined) counts[other.arenaTeam] += 1;
      }
      player.arenaTeam = counts.blue <= counts.red ? 'blue' : 'red';
    } else {
      player.arenaTeam = 'co-op';
    }
  } else {
    player.arenaTeam = null;
  }
  const spawn = entrySpawn(nextZone, entry);
  player.x = spawn.x;
  player.y = spawn.y;
  player.respawnAt = 0;
  player.lastZoneTravelAt = Date.now();
  nextZone.players[player.id] = player;
  nextZone.memberCount += 1;
  socket.join('zone:' + nextZone.id);
  unlockHaven(player, nextZone, socket);
  socket.emit('player:position', { x: player.x, y: player.y });
  socket.emit('archive:echoes', nextZone.echoes);
  socket.emit('zone:changed', {
    zone: zoneMeta(nextZone),
    mode: nextZone.mode,
    arena: !!nextZone.arena,
    friendlyFire: nextZone.friendlyFire !== false,
    spawn: { x: player.x, y: player.y }
  });
  nextZone.broadcast();
  hooks.emit('zoneChanged', player, socket);
}

function buildPlayer(socket, requestedName, profile, zone) {
  const requestedDomain = LEGACY_DOMAINS[profile.energyColor] || profile.energyColor;
  const storedDomain = ACTIVE_DOMAINS.has(requestedDomain) ? requestedDomain : 'cipher';
  const storedCities = Array.isArray(profile.unlockedCities) ? profile.unlockedCities.filter((id) => HAVEN_IDS.has(id)) : [];
  if (!storedCities.includes('haven-perimeter')) storedCities.unshift('haven-perimeter');
  const storedTowers = {};
  for (let i = 1; i <= 5; i += 1) storedTowers[i] = !!profile.towers?.[i];
  const homeCity = HAVEN_IDS.has(profile.homeCity) && storedCities.includes(profile.homeCity)
    ? profile.homeCity
    : 'haven-perimeter';
  const player = {
    id: socket.id,
    name: requestedName,
    zoneId: zone.id,
    x: (zone.spawn || { x: zone.world.width / 2, y: zone.world.height / 2 }).x,
    y: (zone.spawn || { x: zone.world.width / 2, y: zone.world.height / 2 }).y,
    energyColor: storedDomain,
    color: SLEEVE_COLORS[storedDomain],
    accentColor: SLEEVE_ACCENTS[storedDomain],
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
    credits: Number.isFinite(profile.credits) ? Math.max(0, Math.round(profile.credits)) : 35,
    gearAtk: 0,
    homeCity,
    unlockedCities: storedCities,
    towers: storedTowers,
    arenaTeam: null,
    inCore: false,
    slowUntil: 0,
    speedUntil: 0,
    burnUntil: 0,
    burnPower: 0,
    burnSourceId: null,
    slowRemaining: 0,
    hasteRemaining: 0,
    burnRemaining: 0,
    abilityId: '',
    abilityName: '',
    abilityShort: '',
    abilityCooldown: 0,
    abilityCooldownMax: 1,
    respawnAt: 0,
    kills: 0,
    deaths: 0,
    xp: Number.isFinite(profile.xp) ? Math.max(0, profile.xp) : 0,
    level: 1,
    xpIntoLevel: 0,
    xpNeeded: 120,
    lastHitBy: null,
    lastAttackAt: 0,
    lastDashAt: 0,
    lastShieldAt: 0,
    lastAbilityAt: 0,
    lastInteractAt: 0,
    lastNpcInteractAt: 0,
    lastGateNoticeAt: 0,
    lastZoneTravelAt: 0,
    edgeDirection: null,
    edgeSince: 0
  };
  return player;
}

function tryEdgeTravel(player, socket, zone) {
  if (!player || !zone || player.hp <= 0) return false;
  const now = Date.now();
  if (now - (player.lastZoneTravelAt || 0) < 900) return false;
  const width = zone.world.width, height = zone.world.height, edge = 52;
  let direction = null;
  if (player.x >= width - edge && zone.exits.east) direction = 'east';
  else if (player.x <= edge && zone.exits.west) direction = 'west';
  else if (player.y <= edge && zone.exits.north) direction = 'north';
  else if (player.y >= height - edge && zone.exits.south) direction = 'south';
  if (!direction) {
    player.edgeDirection = null;
    player.edgeSince = 0;
    return false;
  }
  // Require a deliberate hold at the gate. A single reposition packet (used by
  // tests and teleport effects) should not fling an operative through a road.
  if (player.edgeDirection !== direction) {
    player.edgeDirection = direction;
    player.edgeSince = now;
    return false;
  }
  if (now - (player.edgeSince || now) < 320) return false;
  const gate = canUseExit(player, zone, direction);
  if (!gate.ok) {
    if (now - (player.lastGateNoticeAt || 0) > 2500) {
      player.lastGateNoticeAt = now;
      socket.emit('hub:notice', gate.reason);
    }
    return true;
  }
  const target = zones[zone.exits[direction]];
  if (!target) return false;
  movePlayerToZone(player, socket, target, EDGE_ENTRY[direction]);
  return true;
}

io.on('connection', (socket) => {
  let player = null;
  console.log('Client connected: ' + socket.id);
  // Plug-and-play modules can claim their own socket events; they receive
  // (player, payload, socket) and player is null until the join completes.
  // Several modules may share one event (e.g. interact = terminals + NPCs).
  for (const [eventName, handlers] of Object.entries(moduleSocketHandlers)) {
    socket.on(eventName, (payload) => {
      for (const handler of handlers) {
        try { handler(playersById[socket.id], payload, socket); }
        catch (error) { console.error('[module socket ' + eventName + '] ' + error.message); }
      }
    });
  }
  socket.emit('server:welcome', { message: 'Connected to The 5 Sleeves Online.', playerId: socket.id, world: DEFAULT_ZONE.world, core: DEFAULT_ZONE.core });
  socket.emit('zones:lobby', lobbyPayload());
  socket.emit('world:map', worldMapPayload());
  socket.emit('party:state', null);

  socket.on('player:join', (payload) => {
    if (player) return;
    // Accepts a bare name (legacy/tests) or { name, zone }.
    const requestedName = typeof payload === 'string' ? payload : payload?.name;
    const requestedZone = typeof payload === 'string' ? null : payload?.zone;
    const requestedFaction = typeof payload === 'string' ? null : payload?.faction;
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
    const isTaken = Object.values(playersById).some((activePlayer) => activePlayer.name.toLowerCase() === nameKey);
    if (isTaken) {
      socket.emit('name_taken', { message: 'Name already taken! Choose another name.' });
      return;
    }
    const zone = zones[requestedZone] || DEFAULT_ZONE;
    const profile = profiles[nameKey] || {};
    player = buildPlayer(socket, name, profile, zone);
    // The customisation module resolves this into energyColor/color/accent.
    player.requestedFaction = requestedFaction;
    // Modules may add profile-backed fields before the player is registered.
    hooks.emit('joining', player, profile);
    playersById[socket.id] = player;
    playerSockets[player.id] = socket;
    zone.players[socket.id] = player;
    zone.memberCount += 1;
    socket.join('zone:' + zone.id);
    refreshLevelFields(player);
    socket.emit('join:accepted', {
      playerId: player.id, name: player.name,
      zone: zoneMeta(zone),
      stats: {
        hp: player.hp, maxHp: player.maxHp, level: player.level, xp: player.xp,
        coreCharge: player.coreCharge, corePoints: player.corePoints,
        credits: player.credits, gearAtk: player.gearAtk,
        homeCity: player.homeCity, unlockedCities: player.unlockedCities, towers: player.towers,
        skillPoints: player.skillPoints, partyXp: player.partyXp,
        atk: player.atk, plating: player.plating, overclock: player.overclock,
        energyColor: player.energyColor, palette: player.palette
      }
    });
    unlockHaven(player, zone, socket);
    socket.emit('world:map', worldMapPayload());
    socket.emit('archive:echoes', zone.echoes);
    zone.broadcast();
    socket.emit('zones:lobby', lobbyPayload());
    hooks.emit('joined', player, socket);
    console.log('Operative joined: ' + player.name + ' in ' + zone.id + ' (' + socket.id + ')');
  });

  // Post-join zone travel (used by the lobby UI and map fast-travel module).
  socket.on('zone:switch', (zoneId) => {
    if (!player || typeof zoneId !== 'string' || !zones[zoneId]) return;
    movePlayerToZone(player, socket, zones[zoneId], 'center');
    socket.emit('zones:lobby', lobbyPayload());
  });

  socket.on('player:move', (position) => {
    if (!player || !position || !Number.isFinite(position.x) || !Number.isFinite(position.y) || player.hp <= 0) return;
    const zone = playerZone(player);
    if (!zone) return;
    player.x = clamp(position.x, 40, zone.world.width - 40);
    player.y = clamp(position.y, 40, zone.world.height - 40);
    tryEdgeTravel(player, socket, zone);
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
    playerZone(player)?.broadcast();
  });

  socket.on('player:color', (colorKey) => {
    if (!player || !ACTIVE_DOMAINS.has(colorKey)) return;
    player.energyColor = colorKey;
    player.color = SLEEVE_COLORS[colorKey];
    player.accentColor = SLEEVE_ACCENTS[colorKey];
    const ability = abilityFor(player);
    player.lastAbilityAt = Math.min(player.lastAbilityAt, Date.now() - ability.cooldown);
    persistPlayer(player);
    playerZone(player)?.broadcast();
  });

  socket.on('player:ability', (direction) => {
    if (!player) return;
    const aim = validDirection(direction);
    const now = Date.now();
    if (!aim || player.hp <= 0 || player.respawnAt > now) return;
    const ability = abilityFor(player);
    if (now - player.lastAbilityAt < ability.cooldown) return;
    player.lastAbilityAt = now;
    const zone = playerZone(player);
    if (!zone) return;
    if (inSafeZone(zone, player)) { socket.emit('hub:notice', 'Sleeve abilities are offline inside the safe hub.'); return; }
    castAbility(zone, player, aim);
    zone.broadcast();
  });

  socket.on('party:invite:send', (targetId) => {
    if (!player || typeof targetId !== 'string' || targetId === player.id) return;
    const target = playersById[targetId];
    // Invites are allowed from the chat roster even at long range; squads can
    // already span zones, and the chat name menu is a first-class entry point.
    if (!target) {
      socket.emit('party:error', 'That operative is not online.');
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
    const inviter = playersById[invite.inviterId];
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
    const text = Array.from(payload.text).filter((character) => { const code = character.charCodeAt(0); return code >= 32 && code !== 127; }).join('').trim().slice(0, 240);
    const channel = payload.channel;
    if (!text) return;
    if (!['global', 'squad', 'faction'].includes(channel)) {
      socket.emit('chat:error', 'Choose Global, Squad, or Faction chat.');
      return;
    }
    const message = { channel, playerId: player.id, name: player.name, faction: player.energyColor, text, time: Date.now(), zoneId: player.zoneId };
    if (channel === 'global') io.emit('chat:message', message);
    else if (channel === 'squad') {
      const party = parties[playerParties[player.id]];
      if (!party) { socket.emit('chat:error', 'Join a squad before using Squad chat.'); return; }
      for (const memberId of party.members) playerSockets[memberId]?.emit('chat:message', message);
    } else {
      // Faction chat reaches your faction everywhere; the zone is tagged so
      // clients can label distant messages.
      for (const factionPlayer of Object.values(playersById)) {
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
    const zone = playerZone(player);
    if (!zone) return;
    if (inSafeZone(zone, player)) { socket.emit('hub:notice', 'Combat is disabled inside the safe hub.'); return; }
    const id = String(zone.next.projectile++);
    zone.projectiles[id] = { id, ownerId: player.id, x: player.x + aim.x * 22, y: player.y + aim.y * 22, vx: aim.x * 520, vy: aim.y * 520, radius: 9, expiresAt: now + 1100, color: player.color, accentColor: player.accentColor };
  });
  socket.on('player:dash', (direction) => {
    if (!player) return;
    const aim = validDirection(direction);
    const now = Date.now();
    const dash = skillBonuses(player);
    if (!aim || player.hp <= 0 || now - player.lastDashAt < Math.max(250, 1300 * Math.pow(0.9, player.overclock) * dash.dashCooldownScale)) return;
    player.lastDashAt = now;
    const zone = playerZone(player);
    if (!zone) return;
    const travel = 120 + dash.dashDistance;
    player.x = clamp(player.x + aim.x * travel, 40, zone.world.width - 40);
    player.y = clamp(player.y + aim.y * travel, 40, zone.world.height - 40);
    socket.emit('player:position', { x: player.x, y: player.y });
    tryEdgeTravel(player, socket, zone);
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
      hooks.emit('left', player);
      removePartyMember(socket.id);
      delete pendingPartyInvites[socket.id];
      for (const [targetId, invite] of Object.entries(pendingPartyInvites)) {
        if (invite.inviterId === socket.id) {
          delete pendingPartyInvites[targetId];
          playerSockets[targetId]?.emit('party:error', 'The inviter left the Conduit.');
        }
      }
      const zone = playerZone(player);
      if (zone) {
        delete zone.players[socket.id];
        zone.memberCount = Math.max(0, zone.memberCount - 1);
        zone.broadcast();
      }
      delete playersById[socket.id];
      delete playerSockets[socket.id];
      console.log('Operative disconnected: ' + player.name + ' (' + reason + ')');
    } else {
      console.log('Unjoined client disconnected: ' + socket.id + ' (' + reason + ')');
    }
  });
});

// ---- Tick loop -------------------------------------------------------------
// Fixed timestep (roadmap #13): the simulation always advances in whole
// FIXED_DT_MS slices, so physics/combat behave identically regardless of
// event-loop jitter. State snapshots go out on a separate BROADCAST_MS
// cadence, so network load can be tuned without touching simulation speed.
// Both are env knobs: FIXED_DT_MS (default 50) and BROADCAST_MS (default 50).
const FIXED_DT_MS = Number.isFinite(Number(process.env.FIXED_DT_MS)) ? clamp(Number(process.env.FIXED_DT_MS), 10, 200) : 50;
const BROADCAST_MS = Number.isFinite(Number(process.env.BROADCAST_MS)) ? Math.max(10, Number(process.env.BROADCAST_MS)) : 50;
const MAX_CATCHUP_STEPS = 5; // drop a backlog instead of spiralling

let lastTick = Date.now();
let accMs = 0;
let lastSnapshotAt = 0;
let lastProfileSave = Date.now();
let lastPartyBroadcast = 0;
let lastLobbyBroadcast = 0;
setInterval(() => {
  const now = Date.now();
  accMs += now - lastTick;
  lastTick = now;

  let steps = 0;
  while (accMs >= FIXED_DT_MS && steps < MAX_CATCHUP_STEPS) {
    const deltaSeconds = FIXED_DT_MS / 1000;
    for (const zone of Object.values(zones)) {
      stepZone(zone, now, deltaSeconds);
      hooks.emit('tick', zone, now, deltaSeconds);
    }
    accMs -= FIXED_DT_MS;
    steps += 1;
  }
  // If we fell far behind (e.g. the process was suspended), resync rather
  // than running a burst of catch-up steps that could starve the event loop.
  if (steps === MAX_CATCHUP_STEPS) accMs = 0;

  if (now - lastSnapshotAt >= BROADCAST_MS) {
    for (const zone of Object.values(zones)) if (zone.memberCount) zone.broadcast();
    lastSnapshotAt = now;
  }

  if (now - lastPartyBroadcast >= 250) {
    for (const partyId of Object.keys(parties)) broadcastParty(partyId);
    lastPartyBroadcast = now;
  }
  // Keep the title-screen lobby counts fresh for connected clients.
  if (now - lastLobbyBroadcast >= 5000) {
    io.emit('zones:lobby', lobbyPayload());
    lastLobbyBroadcast = now;
  }
  if (now - lastProfileSave >= 10000 && Object.keys(playersById).length > 0) {
    for (const player of Object.values(playersById)) persistPlayer(player, false);
    saveProfiles();
    lastProfileSave = now;
  }
}, FIXED_DT_MS);

// Archive Echoes respawn per zone.
const { spawnArchiveEcho, MAX_ARCHIVE_ECHOES } = require('./server/sim/echoes.js');
setInterval(() => {
  for (const zone of Object.values(zones)) {
    if (Object.keys(zone.echoes).length < MAX_ARCHIVE_ECHOES && spawnArchiveEcho(zone)) zone.send('archive:echoes', zone.echoes);
  }
}, 7000);

// ---- Plug-and-play module system (master) ---------------------------------
// Modules live in server/modules/*.js and are booted here. See
// memory/03-module-architecture.md for the contract.
const { createHookBus } = require('./server/hook-bus.js');
const { loadModules } = require('./server/module-loader.js');
const hooks = createHookBus();
const moduleSocketHandlers = {};
const moduleContext = {
  io,
  app,
  players: () => playersById,
  playerSockets: () => playerSockets,
  zones: () => zones,
  playerZone: (playerId) => playerZone(playersById[playerId]),
  on: (event, handler) => hooks.on(event, handler),
  registerSocket: (name, handler) => {
    if (!moduleSocketHandlers[name]) moduleSocketHandlers[name] = [];
    moduleSocketHandlers[name].push(handler);
  },
  route: (method, routePath, handler) => {
    const register = typeof app[method] === 'function' ? app[method].bind(app) : app.get.bind(app);
    register(routePath, handler);
  },
  distance,
  sameParty,
  travel: (player, zoneId, entry = 'center') => {
    const zone = zones[zoneId];
    const socket = playerSockets[player?.id];
    if (player && zone && socket) movePlayerToZone(player, socket, zone, entry);
  },
  worldMap: () => worldMapPayload(),
  zoneMeta,
  entrySpawn,
  canUseExit,
  havenIds: () => HAVEN_IDS,
  gearAtkFor,
  applyXp,
  persistPlayer: (target) => persistPlayer(target),
  xpScale: () => XP_SCALE
};
loadModules(path.join(__dirname, 'server', 'modules'), moduleContext);

httpServer.listen(PORT, '0.0.0.0', () => console.log('The 5 Sleeves server is running at http://localhost:' + PORT));

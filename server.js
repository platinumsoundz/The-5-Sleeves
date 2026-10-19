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
const SLEEVE_COLORS = { azure: '#43b9ff', emerald: '#45f29a', crimson: '#ff536b', violet: '#c875ff' };
const PROFILE_FILE = path.join(__dirname, 'player-profiles.json');
const players = {};
const projectiles = {};
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
function validDirection(direction) {
  if (!direction || !Number.isFinite(direction.x) || !Number.isFinite(direction.y)) return null;
  const length = Math.hypot(direction.x, direction.y);
  return length > 0.01 ? { x: direction.x / length, y: direction.y / length } : null;
}
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
    energyColor: player.energyColor,
    updatedAt: new Date().toISOString()
  };
  saveProfiles();
}

io.on('connection', (socket) => {
  let player = null;
  console.log('Client connected: ' + socket.id);
  socket.emit('server:welcome', { message: 'Connected to The 5 Sleeves Online.', playerId: socket.id, world: WORLD, core: CORE });

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
      energyColor: Object.hasOwn(SLEEVE_COLORS, profile.energyColor) ? profile.energyColor : 'azure',
      color: SLEEVE_COLORS[Object.hasOwn(SLEEVE_COLORS, profile.energyColor) ? profile.energyColor : 'azure'],
      atk: Number.isInteger(profile.atk) ? clamp(profile.atk, 0, 99) : 0,
      plating: Number.isInteger(profile.plating) ? clamp(profile.plating, 0, 99) : 0,
      overclock: Number.isInteger(profile.overclock) ? clamp(profile.overclock, 0, 99) : 0,
      skillPoints: Number.isInteger(profile.skillPoints) ? Math.max(0, profile.skillPoints) : 0,
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
    socket.emit('join:accepted', { playerId: player.id, name: player.name, stats: { hp: player.hp, maxHp: player.maxHp, coreCharge: player.coreCharge, corePoints: player.corePoints, skillPoints: player.skillPoints, atk: player.atk, plating: player.plating, overclock: player.overclock, energyColor: player.energyColor } });
    broadcastState();
    console.log('Operative joined: ' + player.name + ' (' + socket.id + ')');
  });

  socket.on('player:move', (position) => {
    if (!player || !position || !Number.isFinite(position.x) || !Number.isFinite(position.y) || player.hp <= 0) return;
    player.x = clamp(position.x, 20, WORLD.width - 20);
    player.y = clamp(position.y, 20, WORLD.height - 20);
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
    if (!player || !Object.hasOwn(SLEEVE_COLORS, colorKey)) return;
    player.energyColor = colorKey;
    player.color = SLEEVE_COLORS[colorKey];
    persistPlayer(player);
    broadcastState();
  });

  socket.on('player:attack', (direction) => {
    if (!player) return;
    const aim = validDirection(direction);
    const now = Date.now();
    if (!aim || player.hp <= 0 || now - player.lastAttackAt < 450) return;
    player.lastAttackAt = now;
    const id = String(nextProjectileId++);
    projectiles[id] = { id, ownerId: player.id, x: player.x + aim.x * 22, y: player.y + aim.y * 22, vx: aim.x * 520, vy: aim.y * 520, radius: 9, expiresAt: now + 1100, color: player.color };
  });
  socket.on('player:dash', (direction) => {
    if (!player) return;
    const aim = validDirection(direction);
    const now = Date.now();
    if (!aim || player.hp <= 0 || now - player.lastDashAt < Math.max(250, 1300 * Math.pow(0.9, player.overclock))) return;
    player.lastDashAt = now;
    player.x = clamp(player.x + aim.x * 120, 20, WORLD.width - 20);
    player.y = clamp(player.y + aim.y * 120, 20, WORLD.height - 20);
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
      delete players[socket.id];
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

  for (const player of Object.values(players)) {
    player.inCore = player.hp > 0 && distance(player, CORE) <= CORE.radius;
    if (player.inCore) {
      player.coreCharge += deltaSeconds * 25;
      if (player.coreCharge >= 100) {
        player.coreCharge -= 100;
        player.corePoints += 1;
        player.skillPoints += 1;
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
        energyColor: player.energyColor,
        updatedAt: new Date().toISOString()
      };
    }
    saveProfiles();
    lastProfileSave = now;
  }
  broadcastState();
}, 1000);

httpServer.listen(PORT, '0.0.0.0', () => console.log('The 5 Sleeves server is running at http://localhost:' + PORT));

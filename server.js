const path = require('path');
const express = require('express');
const { Server } = require('socket.io');

const app = express();
const httpServer = require('http').createServer(app);
const io = new Server(httpServer);
const PORT = process.env.PORT || 3000;
const WORLD = { width: 1000, height: 700 };
const CORE = { x: WORLD.width / 2, y: WORLD.height / 2, radius: 90 };
const players = {};
const projectiles = {};
let nextProjectileId = 1;
let lastTick = Date.now();

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

io.on('connection', (socket) => {
  const player = {
    id: socket.id,
    name: 'Sleeve-' + socket.id.slice(0, 4),
    x: 100 + Math.random() * (WORLD.width - 200),
    y: 100 + Math.random() * (WORLD.height - 200),
    color: '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0'),
    hp: 100,
    maxHp: 100,
    shieldUntil: 0,
    coreCharge: 0,
    corePoints: 0,
    inCore: false,
    lastAttackAt: 0,
    lastDashAt: 0,
    lastShieldAt: 0
  };
  players[socket.id] = player;
  console.log('Operative connected: ' + socket.id);
  socket.emit('server:welcome', { message: 'Connected to The 5 Sleeves Online.', playerId: socket.id, world: WORLD, core: CORE });
  broadcastState();

  socket.on('player:move', (position) => {
    if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.y) || player.hp <= 0) return;
    player.x = clamp(position.x, 20, WORLD.width - 20);
    player.y = clamp(position.y, 20, WORLD.height - 20);
  });

  socket.on('player:attack', (direction) => {
    const aim = validDirection(direction);
    const now = Date.now();
    if (!aim || player.hp <= 0 || now - player.lastAttackAt < 450) return;
    player.lastAttackAt = now;
    const id = String(nextProjectileId++);
    projectiles[id] = { id, ownerId: player.id, x: player.x + aim.x * 22, y: player.y + aim.y * 22, vx: aim.x * 520, vy: aim.y * 520, radius: 9, expiresAt: now + 1100, color: player.color };
  });

  socket.on('player:dash', (direction) => {
    const aim = validDirection(direction);
    const now = Date.now();
    if (!aim || player.hp <= 0 || now - player.lastDashAt < 1300) return;
    player.lastDashAt = now;
    player.x = clamp(player.x + aim.x * 120, 20, WORLD.width - 20);
    player.y = clamp(player.y + aim.y * 120, 20, WORLD.height - 20);
    socket.emit('player:position', { x: player.x, y: player.y });
  });

  socket.on('player:shield', () => {
    const now = Date.now();
    if (player.hp <= 0 || now - player.lastShieldAt < 4000) return;
    player.lastShieldAt = now;
    player.shieldUntil = now + 1800;
  });

  socket.on('disconnect', (reason) => {
    delete players[socket.id];
    broadcastState();
    console.log('Operative disconnected: ' + socket.id + ' (' + reason + ')');
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
      const damage = now < target.shieldUntil ? 8 : 20;
      target.hp = Math.max(0, target.hp - damage);
      delete projectiles[id];
      hit = true;
      break;
    }
    if (!hit && (now > projectile.expiresAt || projectile.x < 0 || projectile.x > WORLD.width || projectile.y < 0 || projectile.y > WORLD.height)) delete projectiles[id];
  }
  broadcastState();
}, 50);

httpServer.listen(PORT, '0.0.0.0', () => console.log('The 5 Sleeves server is running at http://localhost:' + PORT));

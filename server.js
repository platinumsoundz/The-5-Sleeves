const path = require('path');
const express = require('express');
const { Server } = require('socket.io');

const app = express();
const httpServer = require('http').createServer(app);
const io = new Server(httpServer);
const PORT = process.env.PORT || 3000;
const WORLD = { width: 1000, height: 700 };
const players = {};

app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', (_request, response) => {
  response.json({ status: 'ok', players: Object.keys(players).length });
});

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function broadcastPlayers() {
  io.emit('players', players);
}

io.on('connection', (socket) => {
  const player = {
    id: socket.id,
    name: 'Sleeve-' + socket.id.slice(0, 4),
    x: 100 + Math.random() * (WORLD.width - 200),
    y: 100 + Math.random() * (WORLD.height - 200),
    color: '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0')
  };
  players[socket.id] = player;
  console.log('Operative connected: ' + socket.id);

  socket.emit('server:welcome', {
    message: 'Connected to The 5 Sleeves Online.',
    playerId: socket.id,
    world: WORLD
  });
  broadcastPlayers();

  socket.on('player:move', (position) => {
    if (!players[socket.id] || !position || !Number.isFinite(position.x) || !Number.isFinite(position.y)) {
      return;
    }

    players[socket.id].x = clamp(position.x, 20, WORLD.width - 20);
    players[socket.id].y = clamp(position.y, 20, WORLD.height - 20);
    broadcastPlayers();
  });

  socket.on('disconnect', (reason) => {
    delete players[socket.id];
    broadcastPlayers();
    console.log('Operative disconnected: ' + socket.id + ' (' + reason + ')');
  });
});

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log('The 5 Sleeves server is running at http://localhost:' + PORT);
});

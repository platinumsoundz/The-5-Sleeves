const path = require('path');
const express = require('express');
const { Server } = require('socket.io');

const app = express();
const server = require('http').createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', (_request, response) => {
  response.json({ status: 'ok', players: io.engine.clientsCount });
});

io.on('connection', (socket) => {
  console.log('Operative connected: ' + socket.id);

  socket.emit('server:welcome', {
    message: 'Connected to The 5 Sleeves Online.',
    playerId: socket.id
  });

  socket.on('disconnect', (reason) => {
    console.log('Operative disconnected: ' + socket.id + ' (' + reason + ')');
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('The 5 Sleeves server is running at http://localhost:' + PORT);
});

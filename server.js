const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const session = require('express-session');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, '../frontend')));
app.use(express.json());
const games = {};

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('createGame', () => {
    const roomId = socket.id;
    games[roomId] = { players: [socket.id], board: Array(6).fill(null).map(() => Array(7).fill(0)), turn: 1 };
    socket.join(roomId);
    socket.emit('gameCreated', roomId);
  });

  socket.on('joinGame', (roomId) => {
    if (games[roomId] && games[roomId].players.length === 1) {
      games[roomId].players.push(socket.id);
      socket.join(roomId);
      io.to(roomId).emit('startGame', { board: games[roomId].board });
    } else {
      socket.emit('error', 'Could not join game');
    }
  });

  socket.on('makeMove', ({ roomId, column }) => {
    const game = games[roomId];
    if (!game) return;

    for (let row = 5; row >= 0; row--) {
      if (game.board[row][column] === 0) {
        game.board[row][column] = game.turn;
        game.turn = game.turn === 1 ? 2 : 1;
        io.to(roomId).emit('updateBoard', game.board);
        break;
      }
    }
  });
});

const PORT = 3000;
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));

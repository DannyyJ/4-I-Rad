const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const session = require('express-session');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname)));
app.use(express.json());

const games = {};

function checkWinner(board, player) {
  // Horisontellt
  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 4; col++) {
      if (
        board[row][col] === player &&
        board[row][col + 1] === player &&
        board[row][col + 2] === player &&
        board[row][col + 3] === player
      ) return true;
    }
  }

  // Vertikalt
  for (let col = 0; col < 7; col++) {
    for (let row = 0; row < 3; row++) {
      if (
        board[row][col] === player &&
        board[row + 1][col] === player &&
        board[row + 2][col] === player &&
        board[row + 3][col] === player
      ) return true;
    }
  }

  // Diagonal höger
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 4; col++) {
      if (
        board[row][col] === player &&
        board[row + 1][col + 1] === player &&
        board[row + 2][col + 2] === player &&
        board[row + 3][col + 3] === player
      ) return true;
    }
  }

  // Diagonal vänster
  for (let row = 0; row < 3; row++) {
    for (let col = 3; col < 7; col++) {
      if (
        board[row][col] === player &&
        board[row + 1][col - 1] === player &&
        board[row + 2][col - 2] === player &&
        board[row + 3][col - 3] === player
      ) return true;
    }
  }

  return false;
}

function isBoardFull(board) {
  return board.every(row => row.every(cell => cell !== 0));
}

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('createGame', () => {
    const roomId = socket.id;
    games[roomId] = {
      roomId,
      players: [{ id: socket.id, playerNumber: 1 }],
      board: Array(6).fill(null).map(() => Array(7).fill(0)),
      turn: 1
    };
    socket.join(roomId);
    socket.emit('gameCreated', roomId);
  });

  socket.on('joinGame', (roomId) => {
    const game = games[roomId];
    if (game && game.players.length === 1) {
      game.players.push({ id: socket.id, playerNumber: 2 });
      socket.join(roomId);

      // Skicka spelarroller
      io.to(game.players[0].id).emit('playerInfo', { playerNumber: 1 });
      io.to(game.players[1].id).emit('playerInfo', { playerNumber: 2 });

      io.to(roomId).emit('startGame', { board: game.board });
    } else {
      socket.emit('error', 'Could not join game');
    }
  });

  socket.on('makeMove', ({ roomId, column }) => {
    const game = games[roomId];
    if (!game) return;

    const player = game.players.find(p => p.id === socket.id);
    if (!player) return; // Denna socket tillhör inte spelet

    if (player.playerNumber !== game.turn) {
      socket.emit('error', 'Not your turn!');
      return;
    }

    for (let row = 5; row >= 0; row--) {
      if (game.board[row][column] === 0) {
        game.board[row][column] = player.playerNumber;

        const won = checkWinner(game.board, player.playerNumber);
        const draw = isBoardFull(game.board);

        io.to(roomId).emit('updateBoard', game.board);

        if (won) {
          io.to(roomId).emit('gameOver', { winner: player.playerNumber });
          delete games[roomId];
        } else if (draw) {
          io.to(roomId).emit('gameOver', { winner: 0 }); // 0 betyder oavgjort
          delete games[roomId];
        } else {
          game.turn = game.turn === 1 ? 2 : 1;
        }

        break;
      }
    }
  });

  socket.on('disconnect', () => {
    // Ta bort spel där spelare kopplat från
    for (const roomId in games) {
      const game = games[roomId];
      if (game.players.some(p => p.id === socket.id)) {
        io.to(roomId).emit('gameOver', { winner: null, reason: 'Opponent disconnected' });
        delete games[roomId];
        break;
      }
    }
  });
});

const PORT = 3000;
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));

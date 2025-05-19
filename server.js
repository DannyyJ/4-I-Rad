const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname)));

const games = {};
const leaderboard = {};

function checkWinner(board, player) {
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

function generateRoomId() {
  return Math.random().toString(36).substring(2, 7);
}

io.on('connection', (socket) => {
  console.log('Ny användare ansluten:', socket.id);

  socket.on('setName', (name) => {
    socket.playerName = name;
    console.log(`Namn satt för ${socket.id}: ${name}`);
  });

  socket.on('createGame', () => {
    if (!socket.playerName) {
      socket.emit('error', 'Sätt ditt namn först!');
      return;
    }

    const roomId = generateRoomId();
    games[roomId] = {
      roomId,
      players: [{ id: socket.id, playerNumber: 1, name: socket.playerName, readyForRematch: false }],
      board: Array(6).fill(null).map(() => Array(7).fill(0)),
      turn: 1
    };
    socket.join(roomId);
    socket.currentRoom = roomId;
    socket.emit('gameCreated', roomId);
    console.log(`Spel skapat: ${roomId} av ${socket.playerName} (${socket.id})`);
  });

  socket.on('joinGame', (roomId) => {
    const game = games[roomId];
    if (!socket.playerName) {
      socket.emit('error', 'Sätt ditt namn först!');
      return;
    }
    if (!game) {
      socket.emit('error', 'Rummet finns inte.');
      return;
    }
    if (game.players.length >= 2) {
      socket.emit('error', 'Spelet är fullt.');
      return;
    }
    game.players.push({ id: socket.id, playerNumber: 2, name: socket.playerName, readyForRematch: false });
    socket.join(roomId);
    socket.currentRoom = roomId;

    game.players.forEach(player => {
      io.to(player.id).emit('startGame', { board: game.board });
      io.to(player.id).emit('playerInfo', { playerNumber: player.playerNumber });
    });

    io.in(roomId).emit('leaderboardUpdate', getLeaderboardSorted());
    console.log(`${socket.playerName} (${socket.id}) gick med i rum ${roomId}`);
  });

  socket.on('makeMove', ({ roomId, column }) => {
    const game = games[roomId];
    if (!game) {
      socket.emit('error', 'Spelet finns inte.');
      return;
    }
    const player = game.players.find(p => p.id === socket.id);
    if (!player) {
      socket.emit('error', 'Du är inte med i detta spel.');
      return;
    }
    if (game.turn !== player.playerNumber) {
      socket.emit('error', 'Det är inte din tur.');
      return;
    }

    for (let row = 5; row >= 0; row--) {
      if (game.board[row][column] === 0) {
        game.board[row][column] = player.playerNumber;
        break;
      }
    }

    io.in(roomId).emit('updateBoard', game.board);

    if (checkWinner(game.board, player.playerNumber)) {
      leaderboard[player.name] = (leaderboard[player.name] || 0) + 1;

      io.in(roomId).emit('gameOver', { winner: player.playerNumber });
      io.in(roomId).emit('leaderboardUpdate', getLeaderboardSorted());
      console.log(`${player.name} vann i rum ${roomId}`);

      game.turn = null;
    } else if (isBoardFull(game.board)) {
      io.in(roomId).emit('gameOver', { winner: 0 });
      game.turn = null;
    } else {
      game.turn = player.playerNumber === 1 ? 2 : 1;
    }
  });

  socket.on('playAgain', (roomId) => {
    const game = games[roomId];
    if (!game) return;
    const player = game.players.find(p => p.id === socket.id);
    if (!player) return;

    player.readyForRematch = true;

    if (game.players.every(p => p.readyForRematch)) {
      game.board = Array(6).fill(null).map(() => Array(7).fill(0));
      game.turn = 1;
      game.players.forEach(p => p.readyForRematch = false);

      io.in(roomId).emit('startGame', { board: game.board });
      io.in(roomId).emit('playAgainReady');
      console.log(`Nytt spel startat i rum ${roomId}`);
    } else {
      socket.emit('gameMessage', 'Väntar på motståndaren...');
    }
  });

  socket.on('leaveGame', (roomId) => {
    const game = games[roomId];
    if (!game) return;

    game.players = game.players.filter(p => p.id !== socket.id);

    socket.leave(roomId);
    socket.currentRoom = null;

    if (game.players.length > 0) {
      io.to(game.players[0].id).emit('opponentLeft');
    } else {
      delete games[roomId];
      console.log(`Rum ${roomId} togs bort (tomt)`);
    }
  });

  socket.on('disconnect', () => {
    console.log('Användare kopplade från:', socket.id);
    const roomId = socket.currentRoom;
    if (!roomId) return;

    const game = games[roomId];
    if (!game) return;

    game.players = game.players.filter(p => p.id !== socket.id);

    if (game.players.length > 0) {
      io.to(game.players[0].id).emit('opponentLeft');
    } else {
      delete games[roomId];
      console.log(`Rum ${roomId} togs bort (tomt)`);
    }
  });
});

function getLeaderboardSorted() {
  const arr = Object.entries(leaderboard).map(([name, wins]) => ({ name, wins }));
  arr.sort((a, b) => b.wins - a.wins);
  return arr;
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servern körs på port ${PORT}`);
});

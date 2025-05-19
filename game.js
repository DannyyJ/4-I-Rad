const socket = io();
const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');

const createBtn = document.getElementById('createBtn');
const joinBtn = document.getElementById('joinBtn');
const joinInput = document.getElementById('joinInput');
const roomInfo = document.getElementById('roomInfo');

const gameMessage = document.getElementById('gameMessage');
const endGameButtons = document.getElementById('endGameButtons');
const playAgainBtn = document.getElementById('playAgainBtn');
const leaveBtn = document.getElementById('leaveBtn');

const nameInput = document.getElementById('nameInput');
const setNameBtn = document.getElementById('setNameBtn');

const leaderboardList = document.getElementById('leaderboardList');

let roomId = null;
let board = Array(6).fill(null).map(() => Array(7).fill(0));
let playerNumber = null;
let playerName = null;

function drawBoard() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 7; col++) {
      ctx.beginPath();
      ctx.arc(col * 100 + 50, row * 100 + 50, 40, 0, 2 * Math.PI);
      ctx.fillStyle = board[row][col] === 1 ? 'red' : board[row][col] === 2 ? 'yellow' : 'white';
      ctx.fill();
      ctx.stroke();
    }
  }
}

function resetGameUI() {
  gameMessage.textContent = '';
  endGameButtons.style.display = 'none';
}

function updateLeaderboard(leaderboard) {
  leaderboardList.innerHTML = '';
  leaderboard.forEach(({ name, wins }) => {
    const li = document.createElement('li');
    li.textContent = `${name}: ${wins} vinster`;
    leaderboardList.appendChild(li);
  });
}

canvas.addEventListener('click', (e) => {
  if (!roomId) {
    console.log('No room joined yet.');
    return;
  }
  const column = Math.floor(e.offsetX / 100);
  console.log(`Player ${playerNumber} clicked column ${column} in room ${roomId}`);
  socket.emit('makeMove', { roomId, column });
});

setNameBtn.addEventListener('click', () => {
  const name = nameInput.value.trim();
  if (!name) {
    alert('Ange ett giltigt namn');
    return;
  }
  playerName = name;
  console.log(`Namn satt: ${playerName}`);
  // Aktivera knappar när namn är satt
  createBtn.disabled = false;
  joinBtn.disabled = false;
  nameInput.disabled = true;
  setNameBtn.disabled = true;
  socket.emit('setName', playerName);
});

createBtn.addEventListener('click', () => {
  console.log('Creating game...');
  resetGameUI();
  socket.emit('createGame');
});

joinBtn.addEventListener('click', () => {
  const inputId = joinInput.value.trim();
  if (inputId) {
    console.log(`Trying to join room: ${inputId}`);
    resetGameUI();
    socket.emit('joinGame', inputId);
    roomId = inputId;
    roomInfo.textContent = `Gick med i rum: ${roomId}`;
  }
});

playAgainBtn.addEventListener('click', () => {
  if (!roomId) return;
  console.log('Spela igen klickad');
  resetGameUI();
  socket.emit('playAgain', roomId);
  gameMessage.textContent = 'Väntar på motståndaren...';
  endGameButtons.style.display = 'none';
});

leaveBtn.addEventListener('click', () => {
  console.log('Lämnar lobby');
  socket.emit('leaveGame', roomId);
  roomId = null;
  playerNumber = null;
  board = Array(6).fill(null).map(() => Array(7).fill(0));
  roomInfo.textContent = '';
  resetGameUI();
  drawBoard();
});

socket.on('gameCreated', (id) => {
  console.log(`Game created with room ID: ${id}`);
  roomId = id;
  roomInfo.textContent = `Spel skapat! Rum-ID: ${roomId}`;
});

socket.on('startGame', (data) => {
  console.log('Game started');
  board = data.board;
  drawBoard();
});

socket.on('updateBoard', (newBoard) => {
  console.log('Board updated');
  board = newBoard;
  drawBoard();
});

socket.on('playerInfo', (data) => {
  playerNumber = data.playerNumber;
  console.log(`You are player number ${playerNumber}`);
});

socket.on('error', (msg) => {
  console.log('Error:', msg);
  alert(msg);
});

socket.on('gameOver', ({ winner, reason }) => {
  if (reason) {
    gameMessage.textContent = `Spelet avslutades: ${reason}`;
  } else if (winner === 0) {
    gameMessage.textContent = "Oavgjort! Ingen vann.";
  } else {
    const color = winner === 1 ? 'Röd' : 'Gul';
    gameMessage.textContent = `${color} spelare vinner!`;
  }
  endGameButtons.style.display = 'block';
});

socket.on('leaderboardUpdate', (leaderboard) => {
  updateLeaderboard(leaderboard);
});

socket.on('playAgainReady', () => {
  gameMessage.textContent = 'Båda spelare redo! Spelet startar...';
});

socket.on('opponentLeft', () => {
  gameMessage.textContent = 'Motståndaren lämnade lobbyn.';
  endGameButtons.style.display = 'block';
});

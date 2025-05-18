const socket = io();
const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');

const createBtn = document.getElementById('createBtn');
const joinBtn = document.getElementById('joinBtn');
const joinInput = document.getElementById('joinInput');
const roomInfo = document.getElementById('roomInfo');

let roomId = null;
let board = Array(6).fill(null).map(() => Array(7).fill(0));

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

canvas.addEventListener('click', (e) => {
  if (!roomId) return;
  const column = Math.floor(e.offsetX / 100);
  socket.emit('makeMove', { roomId, column });
});

createBtn.addEventListener('click', () => {
  socket.emit('createGame');
});

joinBtn.addEventListener('click', () => {
  const inputId = joinInput.value.trim();
  if (inputId) {
    socket.emit('joinGame', inputId);
  }
});

socket.on('gameCreated', (id) => {
  roomId = id;
  roomInfo.textContent = `Spel skapat! Rum-ID: ${roomId}`;
});

socket.on('startGame', (data) => {
  board = data.board;
  drawBoard();
});

socket.on('updateBoard', (newBoard) => {
  board = newBoard;
  drawBoard();
});

socket.on('error', (msg) => {
  alert(msg);
});

socket.on('gameOver', ({ winner }) => {
  if (winner === 0) {
    alert("Oavgjort! Ingen vann.");
  } else {
    const color = winner === 1 ? 'Röd' : 'Gul';
    alert(`${color} spelare vinner!`);
  }
});
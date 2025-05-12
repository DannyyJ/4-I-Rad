const socket = io();

function createGame() {
  socket.emit('createGame');
}

function joinGame() {
  const roomId = document.getElementById('roomInput').value;
  socket.emit('joinGame', roomId);
}

socket.on('gameCreated', (roomId) => {
  alert(`Game created. Room ID: ${roomId}`);
});

socket.on('startGame', ({ board }) => {
  renderBoard(board);
});

socket.on('updateBoard', (board) => {
  renderBoard(board);
});

function renderBoard(board) {
  const gameDiv = document.getElementById('game');
  gameDiv.innerHTML = '';
  board.forEach((row, rowIndex) => {
    const rowDiv = document.createElement('div');
    row.forEach((cell, colIndex) => {
      const cellDiv = document.createElement('div');
      cellDiv.className = 'cell';
      cellDiv.textContent = cell === 0 ? '.' : cell;
      cellDiv.onclick = () => socket.emit('makeMove', { roomId: roomId, column: colIndex });
      rowDiv.appendChild(cellDiv);
    });
    gameDiv.appendChild(rowDiv);
  });
}
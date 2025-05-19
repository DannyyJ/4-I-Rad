// Skapar en socket-anslutning till servern
const socket = io();

// Hämtar referens till canvas och dess kontext för att rita spelbrädet
const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');

// Referenser till knappar och inputfält i topControls
const createBtn = document.getElementById('createBtn');
const joinBtn = document.getElementById('joinBtn');
const joinInput = document.getElementById('joinInput');
const roomInfo = document.getElementById('roomInfo');

const gameMessage = document.getElementById('gameMessage');

const playAgainBtn = document.getElementById('playAgainBtn');
const leaveBtn = document.getElementById('leaveBtn');

const nameInput = document.getElementById('nameInput');
const setNameBtn = document.getElementById('setNameBtn');

const leaderboardList = document.getElementById('leaderboardList');

// Spelrelaterade variabler
let roomId = null;
let board = Array(6).fill(null).map(() => Array(7).fill(0)); // Skapar tomt bräde (6 rader × 7 kolumner)
let playerNumber = null;
let playerName = null;

// Funktion för att rita ut spelbrädet
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

// Nollställ meddelanden och göm spela igen & lämna-knappar
function resetGameUI() {
  gameMessage.textContent = '';
  playAgainBtn.style.display = 'none';
  leaveBtn.style.display = 'none';
}

// Uppdaterar topplistan
function updateLeaderboard(leaderboard) {
  leaderboardList.innerHTML = '';
  leaderboard.forEach(({ name, wins }) => {
    const li = document.createElement('li');
    li.textContent = `${name}: ${wins} vinster`;
    leaderboardList.appendChild(li);
  });
}

// När spelaren klickar på spelbrädet för att göra ett drag
canvas.addEventListener('click', (e) => {
  if (!roomId) return;
  const column = Math.floor(e.offsetX / 100);
  socket.emit('makeMove', { roomId, column });
});

// När spelaren sätter sitt namn
setNameBtn.addEventListener('click', () => {
  const name = nameInput.value.trim();
  if (!name) {
    alert('Ange ett giltigt namn');
    return;
  }
  playerName = name;
  createBtn.disabled = false;
  joinBtn.disabled = false;
  nameInput.disabled = true;
  setNameBtn.disabled = true;
  socket.emit('setName', playerName);
});

// Skapa nytt spelrum
createBtn.addEventListener('click', () => {
  resetGameUI();
  socket.emit('createGame');
});

// Gå med i existerande spelrum
joinBtn.addEventListener('click', () => {
  const inputId = joinInput.value.trim();
  if (inputId) {
    resetGameUI();
    socket.emit('joinGame', inputId);
    roomId = inputId;
    roomInfo.textContent = `Gick med i rum: ${roomId}`;
  }
});

// Spela igen-knappen
playAgainBtn.addEventListener('click', () => {
  if (!roomId) return;
  resetGameUI();
  socket.emit('playAgain', roomId);
  gameMessage.textContent = 'Väntar på motståndaren...';
  playAgainBtn.style.display = 'none';
  leaveBtn.style.display = 'none';
});

// Lämna spelrummet
leaveBtn.addEventListener('click', () => {
  socket.emit('leaveGame', roomId);
  roomId = null;
  playerNumber = null;
  board = Array(6).fill(null).map(() => Array(7).fill(0));
  roomInfo.textContent = '';
  resetGameUI();
  drawBoard();
  updateTopControlsUI('notInGame');
});

// Funktion för att visa rätt kontroller beroende på spelsession
function updateTopControlsUI(state) {
  if (state === 'notInGame') {
    // Visa namn + skapa + join, göm spela igen & lämna
    nameInput.style.display = '';
    setNameBtn.style.display = '';
    createBtn.style.display = '';
    joinInput.style.display = '';
    joinBtn.style.display = '';
    playAgainBtn.style.display = 'none';
    leaveBtn.style.display = 'none';

    createBtn.disabled = !playerName;
    joinBtn.disabled = !playerName;
    nameInput.disabled = false;
    setNameBtn.disabled = false;

  } else if (state === 'inGame') {
    // Göm namn + skapa + join, visa lämna, göm spela igen
    nameInput.style.display = 'none';
    setNameBtn.style.display = 'none';
    createBtn.style.display = 'none';
    joinInput.style.display = 'none';
    joinBtn.style.display = 'none';
    playAgainBtn.style.display = 'none';
    leaveBtn.style.display = '';
  } else if (state === 'gameOver') {
    // Göm namn + skapa + join, visa spela igen + lämna
    nameInput.style.display = 'none';
    setNameBtn.style.display = 'none';
    createBtn.style.display = 'none';
    joinInput.style.display = 'none';
    joinBtn.style.display = 'none';
    playAgainBtn.style.display = '';
    leaveBtn.style.display = '';
  }
}

// Initialt, visa kontroller för ej i spel
updateTopControlsUI('notInGame');


// ===================
// SOCKET-EVENTHANTERING
// ===================

// När ett nytt spel har skapats
socket.on('gameCreated', (id) => {
  roomId = id;
  roomInfo.textContent = `Spel skapat! Rum-ID: ${roomId}`;
  updateTopControlsUI('inGame');
});

// När spelet startar
socket.on('startGame', (data) => {
  board = data.board;
  drawBoard();
  updateTopControlsUI('inGame');  // Visa kontroller för pågående spel
  gameMessage.textContent = '';   // Nollställ meddelande
});

// När brädet uppdateras efter ett drag
socket.on('updateBoard', (newBoard) => {
  board = newBoard;
  drawBoard();
});

// Tar emot spelarens nummer (1 eller 2)
socket.on('playerInfo', (data) => {
  playerNumber = data.playerNumber;
});

// Visar felmeddelanden
socket.on('error', (msg) => {
  alert(msg);
});

// När spelet är över
socket.on('gameOver', ({ winner, reason }) => {
  if (reason) {
    gameMessage.textContent = `Spelet avslutades: ${reason}`;
  } else if (winner === 0) {
    gameMessage.textContent = "Oavgjort! Ingen vann.";
  } else {
    const color = winner === 1 ? 'Röd' : 'Gul';
    gameMessage.textContent = `${color} spelare vinner!`;
  }
  updateTopControlsUI('gameOver');  // Visa spela igen + lämna
});

// När topplistan uppdateras
socket.on('leaderboardUpdate', (leaderboard) => {
  updateLeaderboard(leaderboard);
});

// När båda spelare vill spela igen
socket.on('playAgainReady', () => {
  gameMessage.textContent = 'Båda spelare redo! Spelet startar...';
});

// När motståndaren lämnar spelet
socket.on('opponentLeft', () => {
  gameMessage.textContent = 'Motståndaren lämnade lobbyn.';
  updateTopControlsUI('gameOver');  // Visa spela igen + lämna
});


const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

let players = [];
let board = [];
let turnIndex = 0;

function createDeck() {
  let deck = [];
  for (let i = 0; i <= 6; i++) {
    for (let j = i; j <= 6; j++) {
      deck.push([i, j]);
    }
  }
  return deck.sort(() => Math.random() - 0.5);
}

io.on('connection', (socket) => {
  if (players.length >= 4) {
    socket.emit('message', 'Meja GinXeina penuh! Maksimal 4 pemain.');
    return;
  }

  players.push({ id: socket.id, hand: [], name: `Pemain ${players.length + 1}` });
  io.emit('updatePlayers', players.map(p => p.name));

  if (players.length === 2) {
    startGame();
  }

  function startGame() {
    const deck = createDeck();
    board = [];
    turnIndex = 0;

    players.forEach((player, index) => {
      player.hand = deck.slice(index * 7, (index + 1) * 7);
      io.to(player.id).emit('yourHand', player.hand);
    });

    io.emit('gameState', { board, turn: players[turnIndex].id });
    io.emit('message', `Permainan dimulai! Giliran ${players[turnIndex].name}`);
  }

  socket.on('playCard', ({ cardIndex, side }) => {
    const playerIndex = players.findIndex(p => p.id === socket.id);
    if (playerIndex !== turnIndex) return;

    const player = players[playerIndex];
    const card = player.hand[cardIndex];

    if (board.length === 0) {
      board.push(card);
    } else {
      const leftEnd = board[0][0];
      const rightEnd = board[board.length - 1][1];

      if (side === 'left') {
        if (card[1] === leftEnd) board.unshift(card);
        else if (card[0] === leftEnd) board.unshift([card[1], card[0]]);
        else return socket.emit('message', 'Kartu tidak cocok di sisi kiri!');
      } else {
        if (card[0] === rightEnd) board.push(card);
        else if (card[1] === rightEnd) board.push([card[1], card[0]]);
        else return socket.emit('message', 'Kartu tidak cocok di sisi kanan!');
      }
    }

    player.hand.splice(cardIndex, 1);
    io.to(player.id).emit('yourHand', player.hand);

    if (player.hand.length === 0) {
      io.emit('gameState', { board, turn: null });
      io.emit('message', `🏆 ${player.name} memenangkan GinXeina Domino!`);
      return;
    }

    turnIndex = (turnIndex + 1) % players.length;
    io.emit('gameState', { board, turn: players[turnIndex].id });
    io.emit('message', `Giliran ${players[turnIndex].name}`);
  });

  socket.on('passTurn', () => {
    const playerIndex = players.findIndex(p => p.id === socket.id);
    if (playerIndex !== turnIndex) return;

    turnIndex = (turnIndex + 1) % players.length;
    io.emit('gameState', { board, turn: players[turnIndex].id });
    io.emit('message', `${players[playerIndex].name} lewat. Giliran ${players[turnIndex].name}`);
  });

  socket.on('disconnect', () => {
    players = players.filter(p => p.id !== socket.id);
    io.emit('updatePlayers', players.map(p => p.name));
    io.emit('message', 'Seorang pemain meninggalkan meja.');
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`GinXeina Domino berjalan di port ${PORT}`);
});

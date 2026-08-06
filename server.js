const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

let waitingPlayer = null;
let roomCounter = 1;

io.on('connection', (socket) => {
    console.log(`Commander connected: ${socket.id}`);

    // Matchmaking request
    socket.on('find_match', (data) => {
        socket.username = data.username || 'Commander';

        if (waitingPlayer && waitingPlayer.id !== socket.id) {
            // Pair players in a room
            const roomId = `room_${roomCounter++}`;
            const player1 = waitingPlayer;
            const player2 = socket;

            player1.join(roomId);
            player2.join(roomId);

            player1.roomId = roomId;
            player2.roomId = roomId;

            player1.team = 'player'; // Green / Left side
            player2.team = 'enemy';  // Yellow / Right side

            // Notify both players match is ready
            io.to(player1.id).emit('match_found', {
                roomId: roomId,
                team: 'player',
                opponentName: player2.username
            });

            io.to(player2.id).emit('match_found', {
                roomId: roomId,
                team: 'enemy',
                opponentName: player1.username
            });

            waitingPlayer = null;
            console.log(`Battle started in ${roomId}: ${player1.username} vs ${player2.username}`);
        } else {
            // Place in waiting queue
            waitingPlayer = socket;
            socket.emit('waiting_for_opponent', { message: 'Searching for an enemy Commander...' });
        }
    });

    socket.on('start_battle', (data) => {
        if (socket.roomId) {
            socket.to(socket.roomId).emit('opponent_start_battle', data);
        }
    });

    socket.on('spawn_unit', (data) => {
        if (socket.roomId) {
            socket.to(socket.roomId).emit('opponent_spawn_unit', data);
        }
    });

    socket.on('build_structure', (data) => {
        if (socket.roomId) {
            socket.to(socket.roomId).emit('opponent_build_structure', data);
        }
    });

    socket.on('unit_command', (data) => {
        if (socket.roomId) {
            socket.to(socket.roomId).emit('opponent_unit_command', data);
        }
    });

    socket.on('supply_drop', (data) => {
        if (socket.roomId) {
            socket.to(socket.roomId).emit('opponent_supply_drop', data);
        }
    });

    socket.on('disconnect', () => {
        console.log(`Commander disconnected: ${socket.id}`);
        if (waitingPlayer && waitingPlayer.id === socket.id) {
            waitingPlayer = null;
        }
        if (socket.roomId) {
            socket.to(socket.roomId).emit('opponent_disconnected', {
                message: 'Your opponent has surrendered or lost connection!'
            });
        }
    });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
    console.log(`Toy Soldier RTS Server running on port ${PORT}`);
});

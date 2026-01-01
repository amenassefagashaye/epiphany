// server.ts - Deno Deploy compatible WebSocket server
import { Application, Router } from "oak";
import { v4 as uuidv4 } from "uuid";

// Load environment variables (optional)
// import { load } from "dotenv";
// await load({ export: true });

// Types
interface Player {
  id: string;
  name: string;
  socket: WebSocket;
  roomId: string | null;
}

interface Room {
  id: string;
  name: string;
  players: Player[];
  gameState: 'waiting' | 'playing' | 'finished';
  hostId: string;
  maxPlayers: number;
}

// In-memory storage (consider using Deno KV for persistence in production)
const players = new Map<string, Player>();
const rooms = new Map<string, Room>();

// Create Oak application
const app = new Application();
const router = new Router();

// Enable CORS
app.use(async (ctx, next) => {
  ctx.response.headers.set("Access-Control-Allow-Origin", "*");
  ctx.response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  ctx.response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  
  if (ctx.request.method === "OPTIONS") {
    ctx.response.status = 200;
    return;
  }
  
  await next();
});

// Health check endpoint
router.get("/health", (ctx) => {
  ctx.response.body = { status: "ok", timestamp: new Date().toISOString() };
});

// Get rooms list
router.get("/rooms", (ctx) => {
  const roomList = Array.from(rooms.values()).map(room => ({
    id: room.id,
    name: room.name,
    playerCount: room.players.length,
    maxPlayers: room.maxPlayers,
    gameState: room.gameState,
    hostName: room.players.find(p => p.id === room.hostId)?.name || 'Unknown'
  }));
  
  ctx.response.body = { rooms: roomList };
});

// WebSocket handler
app.use(async (ctx) => {
  if (ctx.request.url.pathname === "/ws") {
    if (!ctx.isUpgradable) {
      ctx.throw(501);
    }
    
    const ws = ctx.upgrade();
    const playerId = uuidv4();
    
    ws.onopen = () => {
      console.log(`Player ${playerId} connected`);
      players.set(playerId, {
        id: playerId,
        name: `Player-${playerId.slice(0, 8)}`,
        socket: ws,
        roomId: null
      });
      
      // Send welcome message
      ws.send(JSON.stringify({
        type: 'welcome',
        playerId,
        message: 'Connected to Assefa Bingo Server'
      }));
    };
    
    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data as string);
        handleWebSocketMessage(playerId, message, ws);
      } catch (error) {
        console.error('Error parsing message:', error);
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Invalid message format'
        }));
      }
    };
    
    ws.onclose = () => {
      console.log(`Player ${playerId} disconnected`);
      const player = players.get(playerId);
      if (player?.roomId) {
        handlePlayerLeaveRoom(playerId, player.roomId);
      }
      players.delete(playerId);
    };
    
    ws.onerror = (error) => {
      console.error(`WebSocket error for player ${playerId}:`, error);
    };
  }
});

// Apply routes
app.use(router.routes());
app.use(router.allowedMethods());

// WebSocket message handler
function handleWebSocketMessage(playerId: string, message: any, ws: WebSocket) {
  const player = players.get(playerId);
  
  switch (message.type) {
    case 'login':
      handleLogin(playerId, message.playerName, ws);
      break;
      
    case 'create_room':
      handleCreateRoom(playerId, message.roomName, message.maxPlayers || 10, ws);
      break;
      
    case 'join_room':
      handleJoinRoom(playerId, message.roomId, ws);
      break;
      
    case 'leave_room':
      if (player?.roomId) {
        handlePlayerLeaveRoom(playerId, player.roomId);
      }
      break;
      
    case 'start_game':
      if (player?.roomId) {
        handleStartGame(playerId, player.roomId);
      }
      break;
      
    case 'call_number':
      if (player?.roomId) {
        handleCallNumber(playerId, player.roomId);
      }
      break;
      
    case 'get_rooms':
      sendRoomList(ws);
      break;
      
    default:
      ws.send(JSON.stringify({
        type: 'error',
        message: `Unknown message type: ${message.type}`
      }));
  }
}

// Room management functions
function handleLogin(playerId: string, playerName: string, ws: WebSocket) {
  const player = players.get(playerId);
  if (player) {
    player.name = playerName;
    ws.send(JSON.stringify({
      type: 'login_success',
      playerId,
      playerName
    }));
  }
}

function handleCreateRoom(playerId: string, roomName: string, maxPlayers: number, ws: WebSocket) {
  const roomId = uuidv4();
  const player = players.get(playerId);
  
  if (!player) return;
  
  const room: Room = {
    id: roomId,
    name: roomName,
    players: [player],
    gameState: 'waiting',
    hostId: playerId,
    maxPlayers: Math.min(maxPlayers, 20)
  };
  
  rooms.set(roomId, room);
  player.roomId = roomId;
  
  // Notify player
  ws.send(JSON.stringify({
    type: 'room_created',
    roomId,
    roomName,
    maxPlayers: room.maxPlayers
  }));
  
  // Broadcast to all connected clients about new room
  broadcastRoomList();
}

function handleJoinRoom(playerId: string, roomId: string, ws: WebSocket) {
  const player = players.get(playerId);
  const room = rooms.get(roomId);
  
  if (!player || !room) {
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Room not found'
    }));
    return;
  }
  
  if (room.players.length >= room.maxPlayers) {
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Room is full'
    }));
    return;
  }
  
  // Leave current room if any
  if (player.roomId && player.roomId !== roomId) {
    handlePlayerLeaveRoom(playerId, player.roomId);
  }
  
  // Join new room
  room.players.push(player);
  player.roomId = roomId;
  
  // Notify player
  ws.send(JSON.stringify({
    type: 'room_joined',
    roomId,
    roomName: room.name,
    players: room.players.map(p => ({ id: p.id, name: p.name })),
    gameState: room.gameState,
    hostId: room.hostId
  }));
  
  // Notify other players in the room
  room.players.forEach(p => {
    if (p.id !== playerId) {
      p.socket.send(JSON.stringify({
        type: 'player_joined',
        playerId,
        playerName: player.name,
        roomId
      }));
    }
  });
  
  broadcastRoomList();
}

function handleStartGame(playerId: string, roomId: string) {
  const room = rooms.get(roomId);
  
  if (!room || room.hostId !== playerId) return;
  
  room.gameState = 'playing';
  
  // Generate bingo boards for all players
  room.players.forEach(player => {
    const board = generateBingoBoard();
    player.socket.send(JSON.stringify({
      type: 'game_started',
      roomId,
      board,
      playerCount: room.players.length
    }));
  });
  
  broadcastRoomList();
}

// Helper functions
function handlePlayerLeaveRoom(playerId: string, roomId: string) {
  const room = rooms.get(roomId);
  if (!room) return;
  
  room.players = room.players.filter(p => p.id !== playerId);
  
  // Notify other players
  room.players.forEach(player => {
    player.socket.send(JSON.stringify({
      type: 'player_left',
      playerId,
      roomId
    }));
  });
  
  // Update room or delete if empty
  if (room.players.length === 0) {
    rooms.delete(roomId);
  } else if (room.hostId === playerId) {
    // Assign new host
    room.hostId = room.players[0].id;
  }
  
  broadcastRoomList();
}

function handleCallNumber(playerId: string, roomId: string) {
  const room = rooms.get(roomId);
  if (!room || room.gameState !== 'playing') return;
  
  const number = Math.floor(Math.random() * 75) + 1;
  
  room.players.forEach(player => {
    player.socket.send(JSON.stringify({
      type: 'number_called',
      number,
      callerId: playerId,
      callerName: players.get(playerId)?.name,
      roomId
    }));
  });
}

function generateBingoBoard(): number[][] {
  const board: number[][] = [];
  
  for (let i = 0; i < 5; i++) {
    const row: number[] = [];
    for (let j = 0; j < 5; j++) {
      if (i === 2 && j === 2) {
        row.push(0); // Free space
      } else {
        const min = j * 15 + 1;
        const max = min + 14;
        row.push(Math.floor(Math.random() * (max - min + 1)) + min);
      }
    }
    board.push(row);
  }
  
  return board;
}

function broadcastRoomList() {
  const roomList = Array.from(rooms.values()).map(room => ({
    id: room.id,
    name: room.name,
    playerCount: room.players.length,
    maxPlayers: room.maxPlayers,
    gameState: room.gameState,
    hostName: room.players.find(p => p.id === room.hostId)?.name || 'Unknown'
  }));
  
  players.forEach(player => {
    player.socket.send(JSON.stringify({
      type: 'room_list',
      rooms: roomList
    }));
  });
}

function sendRoomList(ws: WebSocket) {
  const roomList = Array.from(rooms.values()).map(room => ({
    id: room.id,
    name: room.name,
    playerCount: room.players.length,
    maxPlayers: room.maxPlayers,
    gameState: room.gameState,
    hostName: room.players.find(p => p.id === room.hostId)?.name || 'Unknown'
  }));
  
  ws.send(JSON.stringify({
    type: 'room_list',
    rooms: roomList
  }));
}

// Start server
const PORT = Deno.env.get("PORT") || 8080;
console.log(`🚀 Assefa Bingo Server starting on port ${PORT}...`);
console.log(`📡 WebSocket endpoint: ws://localhost:${PORT}/ws`);
console.log(`🌐 Health check: http://localhost:${PORT}/health`);

await app.listen({ port: Number(PORT) });

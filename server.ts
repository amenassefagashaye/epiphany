// Deno Real-Time Bingo Server
import { Application, Router } from "https://deno.land/x/oak@v12.6.1/mod.ts";
import { WebSocket, WebSocketClient } from "https://deno.land/x/websocket@v0.1.4/mod.ts";

// Types
interface Player {
  id: string;
  name: string;
  socket: WebSocketClient;
  isHost: boolean;
  board?: any;
}

interface Room {
  code: string;
  hostId: string;
  gameType: string;
  status: 'waiting' | 'playing' | 'finished';
  players: Player[];
  calledNumbers: number[];
  currentNumber?: number;
  winPattern: string;
  winners: any[];
  createdAt: number;
}

interface GameMessage {
  type: string;
  [key: string]: any;
}

// Game Manager
class GameManager {
  private rooms: Map<string, Room> = new Map();
  private players: Map<string, Player> = new Map();
  private roomCodes: Set<string> = new Set();
  
  generateRoomCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code: string;
    
    do {
      code = '';
      for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
    } while (this.roomCodes.has(code));
    
    this.roomCodes.add(code);
    return code;
  }
  
  createRoom(host: Player, gameType: string): Room {
    const code = this.generateRoomCode();
    const room: Room = {
      code,
      hostId: host.id,
      gameType,
      status: 'waiting',
      players: [host],
      calledNumbers: [],
      winPattern: this.getDefaultPattern(gameType),
      winners: [],
      createdAt: Date.now()
    };
    
    host.isHost = true;
    this.rooms.set(code, room);
    
    console.log(`Room created: ${code} by ${host.name}`);
    return room;
  }
  
  joinRoom(code: string, player: Player): Room | null {
    const room = this.rooms.get(code);
    if (!room || room.status !== 'waiting' || room.players.length >= 10) {
      return null;
    }
    
    room.players.push(player);
    this.broadcastToRoom(room, {
      type: 'player_joined',
      player: { id: player.id, name: player.name }
    });
    
    console.log(`${player.name} joined room ${code}`);
    return room;
  }
  
  leaveRoom(code: string, playerId: string): void {
    const room = this.rooms.get(code);
    if (!room) return;
    
    const playerIndex = room.players.findIndex(p => p.id === playerId);
    if (playerIndex === -1) return;
    
    const player = room.players[playerIndex];
    room.players.splice(playerIndex, 1);
    
    // If host leaves, assign new host
    if (playerId === room.hostId && room.players.length > 0) {
      room.hostId = room.players[0].id;
      room.players[0].isHost = true;
    }
    
    // If room is empty, delete it
    if (room.players.length === 0) {
      this.rooms.delete(code);
      this.roomCodes.delete(code);
      console.log(`Room deleted: ${code}`);
    } else {
      this.broadcastToRoom(room, {
        type: 'player_left',
        playerId,
        playerName: player.name
      });
      
      console.log(`${player.name} left room ${code}`);
    }
  }
  
  startGame(code: string): boolean {
    const room = this.rooms.get(code);
    if (!room || room.status !== 'waiting') return false;
    
    room.status = 'playing';
    room.calledNumbers = [];
    room.winners = [];
    
    // Generate boards for all players
    room.players.forEach(player => {
      player.board = this.generateBoard(room.gameType);
    });
    
    this.broadcastToRoom(room, {
      type: 'game_started',
      gameState: this.getRoomState(room)
    });
    
    console.log(`Game started in room ${code}`);
    return true;
  }
  
  callNumber(code: string, callerId: string): number | null {
    const room = this.rooms.get(code);
    if (!room || room.status !== 'playing' || room.hostId !== callerId) {
      return null;
    }
    
    const gameType = room.gameType;
    let number: number;
    
    do {
      if (gameType === '75ball' || gameType === 'pattern') {
        number = Math.floor(Math.random() * 75) + 1;
      } else if (gameType === '90ball') {
        number = Math.floor(Math.random() * 90) + 1;
      } else if (gameType === '30ball') {
        number = Math.floor(Math.random() * 30) + 1;
      } else {
        number = Math.floor(Math.random() * 50) + 1;
      }
    } while (room.calledNumbers.includes(number));
    
    room.calledNumbers.push(number);
    room.currentNumber = number;
    
    const caller = room.players.find(p => p.id === callerId);
    
    this.broadcastToRoom(room, {
      type: 'number_called',
      number,
      callerId,
      callerName: caller?.name || 'Host',
      calledNumbers: room.calledNumbers
    });
    
    console.log(`Number called in ${code}: ${number}`);
    return number;
  }
  
  claimWin(code: string, playerId: string, pattern: string): boolean {
    const room = this.rooms.get(code);
    if (!room || room.status !== 'playing') return false;
    
    const player = room.players.find(p => p.id === playerId);
    if (!player) return false;
    
    // Verify win condition (simplified for demo)
    const isValidWin = this.verifyWin(player, room, pattern);
    
    if (isValidWin) {
      room.winners.push({
        playerId,
        playerName: player.name,
        pattern,
        timestamp: Date.now()
      });
      
      this.broadcastToRoom(room, {
        type: 'player_win',
        playerId,
        playerName: player.name,
        pattern,
        prize: this.calculatePrize(room)
      });
      
      console.log(`${player.name} won in room ${code} with pattern: ${pattern}`);
      return true;
    }
    
    return false;
  }
  
  sendChatMessage(code: string, playerId: string, message: string): void {
    const room = this.rooms.get(code);
    if (!room) return;
    
    const player = room.players.find(p => p.id === playerId);
    if (!player) return;
    
    this.broadcastToRoom(room, {
      type: 'chat_message',
      playerId,
      playerName: player.name,
      message,
      timestamp: Date.now()
    });
  }
  
  getActiveRooms(): any[] {
    return Array.from(this.rooms.values()).map(room => ({
      code: room.code,
      gameType: room.gameType,
      hostName: room.players.find(p => p.id === room.hostId)?.name || 'Unknown',
      playerCount: room.players.length,
      status: room.status,
      createdAt: room.createdAt
    }));
  }
  
  getRoomState(room: Room): any {
    return {
      code: room.code,
      gameType: room.gameType,
      status: room.status,
      hostId: room.hostId,
      players: room.players.map(p => ({
        id: p.id,
        name: p.name,
        isHost: p.isHost
      })),
      calledNumbers: room.calledNumbers,
      currentNumber: room.currentNumber,
      winPattern: room.winPattern,
      winners: room.winners
    };
  }
  
  broadcastToRoom(room: Room, message: any): void {
    const messageStr = JSON.stringify(message);
    room.players.forEach(player => {
      if (player.socket.isClosed) return;
      try {
        player.socket.send(messageStr);
      } catch (error) {
        console.error('Failed to send message:', error);
      }
    });
  }
  
  sendToPlayer(playerId: string, message: any): void {
    const player = this.players.get(playerId);
    if (player && !player.socket.isClosed) {
      player.socket.send(JSON.stringify(message));
    }
  }
  
  private generateBoard(gameType: string): any {
    switch (gameType) {
      case '75ball':
        return this.generate75BallBoard();
      case '90ball':
        return this.generate90BallBoard();
      case '30ball':
        return this.generate30BallBoard();
      case 'pattern':
        return this.generatePatternBoard();
      default:
        return this.generate75BallBoard();
    }
  }
  
  private generate75BallBoard(): number[][] {
    const columns: number[][] = [];
    
    // B: 1-15, I: 16-30, N: 31-45, G: 46-60, O: 61-75
    const ranges = [
      [1, 15], [16, 30], [31, 45], [46, 60], [61, 75]
    ];
    
    for (let col = 0; col < 5; col++) {
      const [min, max] = ranges[col];
      const numbers = new Set<number>();
      
      while (numbers.size < 5) {
        numbers.add(Math.floor(Math.random() * (max - min + 1)) + min);
      }
      
      columns.push(Array.from(numbers).sort((a, b) => a - b));
    }
    
    // Transpose columns to rows
    const board: number[][] = [];
    for (let row = 0; row < 5; row++) {
      board[row] = [];
      for (let col = 0; col < 5; col++) {
        board[row][col] = columns[col][row];
      }
    }
    
    // Center is free
    board[2][2] = 0;
    
    return board;
  }
  
  private generate90BallBoard(): number[][] {
    const board: number[][] = Array(3).fill(null).map(() => Array(9).fill(null));
    
    const ranges = [
      [1, 10], [11, 20], [21, 30], [31, 40], [41, 50],
      [51, 60], [61, 70], [71, 80], [81, 90]
    ];
    
    for (let col = 0; col < 9; col++) {
      const [min, max] = ranges[col];
      const numbers = new Set<number>();
      
      // Each column has 1-3 numbers
      const count = Math.floor(Math.random() * 3) + 1;
      
      while (numbers.size < count) {
        numbers.add(Math.floor(Math.random() * (max - min + 1)) + min);
      }
      
      // Place numbers in random rows
      const sortedNumbers = Array.from(numbers).sort((a, b) => a - b);
      const positions = [0, 1, 2].sort(() => Math.random() - 0.5).slice(0, count);
      
      positions.forEach((row, index) => {
        board[row][col] = sortedNumbers[index];
      });
    }
    
    return board;
  }
  
  private generate30BallBoard(): number[] {
    const numbers = new Set<number>();
    
    while (numbers.size < 9) {
      numbers.add(Math.floor(Math.random() * 30) + 1);
    }
    
    return Array.from(numbers).sort((a, b) => a - b);
  }
  
  private generatePatternBoard(): number[][] {
    return this.generate75BallBoard();
  }
  
  private getDefaultPattern(gameType: string): string {
    switch (gameType) {
      case '75ball':
        return 'full-house';
      case '90ball':
        return 'one-line';
      case '30ball':
        return 'full-house';
      case 'pattern':
        return 'x-pattern';
      default:
        return 'full-house';
    }
  }
  
  private verifyWin(player: Player, room: Room, claimedPattern: string): boolean {
    // Simplified win verification
    // In a real game, this would check the actual board against called numbers
    const markedCount = this.calculateMarkedCount(player, room);
    const totalCells = this.getTotalCells(room.gameType);
    
    switch (claimedPattern) {
      case 'full-house':
        return markedCount >= totalCells * 0.8;
      case 'one-line':
        return markedCount >= totalCells * 0.2;
      case 'x-pattern':
        return markedCount >= totalCells * 0.3;
      default:
        return markedCount >= totalCells * 0.5;
    }
  }
  
  private calculateMarkedCount(player: Player, room: Room): number {
    // Simplified: Assume player has marked all called numbers that are on their board
    if (!player.board) return 0;
    
    const boardNumbers = this.flattenBoard(player.board, room.gameType);
    return room.calledNumbers.filter(num => boardNumbers.includes(num)).length;
  }
  
  private flattenBoard(board: any, gameType: string): number[] {
    if (gameType === '30ball') {
      return board.filter((n: number) => n > 0);
    }
    
    if (Array.isArray(board[0])) {
      return board.flat().filter((n: number) => n > 0);
    }
    
    return board.filter((n: number) => n > 0);
  }
  
  private getTotalCells(gameType: string): number {
    switch (gameType) {
      case '75ball':
      case 'pattern':
        return 24; // 25 minus free center
      case '90ball':
        return 15; // 3x5 with blanks
      case '30ball':
        return 9;
      default:
        return 24;
    }
  }
  
  private calculatePrize(room: Room): number {
    const playerCount = room.players.length;
    const basePrize = playerCount * 25; // 25 birr per player
    return Math.floor(basePrize * 0.97); // 3% service charge
  }
}

// Main Server
const app = new Application();
const router = new Router();
const gameManager = new GameManager();

// WebSocket handling
const wss = new Set<WebSocketClient>();

router.get("/ws", async (ctx) => {
  const socket = await ctx.upgrade();
  const client: WebSocketClient = socket as any;
  
  wss.add(client);
  
  client.on("open", () => {
    console.log("WebSocket connected");
    
    // Send welcome message
    const playerId = generatePlayerId();
    gameManager.players.set(playerId, {
      id: playerId,
      name: '',
      socket: client,
      isHost: false
    });
    
    client.send(JSON.stringify({
      type: 'player_connected',
      playerId
    }));
    
    // Send active rooms
    client.send(JSON.stringify({
      type: 'rooms_list',
      rooms: gameManager.getActiveRooms()
    }));
  });
  
  client.on("message", (message: string) => {
    try {
      const data: GameMessage = JSON.parse(message);
      handleWebSocketMessage(client, data);
    } catch (error) {
      console.error("Error parsing message:", error);
    }
  });
  
  client.on("close", () => {
    wss.delete(client);
    
    // Find and remove player from rooms
    const player = Array.from(gameManager.players.values())
      .find(p => p.socket === client);
    
    if (player) {
      // Find which room the player is in
      const rooms = gameManager.getActiveRooms();
      for (const room of rooms) {
        const roomObj = gameManager.getRoom(room.code);
        if (roomObj && roomObj.players.some(p => p.id === player.id)) {
          gameManager.leaveRoom(room.code, player.id);
          break;
        }
      }
      
      gameManager.players.delete(player.id);
    }
    
    console.log("WebSocket disconnected");
  });
  
  client.on("error", (error: Error) => {
    console.error("WebSocket error:", error);
  });
});

// HTTP Routes
router.get("/api/rooms", (ctx) => {
  ctx.response.body = gameManager.getActiveRooms();
});

router.get("/api/health", (ctx) => {
  ctx.response.body = { status: "ok", timestamp: Date.now() };
});

// Helper function to extend GameManager
(gameManager as any).getRoom = function(code: string): Room | undefined {
  return this.rooms.get(code);
};

// Message handler
function handleWebSocketMessage(client: WebSocketClient, data: GameMessage) {
  const player = Array.from(gameManager.players.values())
    .find(p => p.socket === client);
  
  if (!player) return;
  
  switch (data.type) {
    case 'create_room':
      handleCreateRoom(player, data);
      break;
      
    case 'join_room':
      handleJoinRoom(player, data);
      break;
      
    case 'leave_room':
      handleLeaveRoom(player, data);
      break;
      
    case 'start_game':
      handleStartGame(player, data);
      break;
      
    case 'call_number':
      handleCallNumber(player, data);
      break;
      
    case 'claim_win':
      handleClaimWin(player, data);
      break;
      
    case 'chat_message':
      handleChatMessage(player, data);
      break;
      
    case 'get_rooms':
      client.send(JSON.stringify({
        type: 'rooms_list',
        rooms: gameManager.getActiveRooms()
      }));
      break;
  }
}

function handleCreateRoom(player: Player, data: GameMessage) {
  if (!data.playerName || !data.gameType) {
    player.socket.send(JSON.stringify({
      type: 'error',
      message: 'Missing player name or game type'
    }));
    return;
  }
  
  player.name = data.playerName;
  
  const room = gameManager.createRoom(player, data.gameType);
  
  player.socket.send(JSON.stringify({
    type: 'room_created',
    roomCode: room.code,
    gameState: gameManager.getRoomState(room),
    board: player.board
  }));
  
  // Notify all clients about room list update
  broadcastRoomListUpdate();
}

function handleJoinRoom(player: Player, data: GameMessage) {
  if (!data.roomCode || !data.playerName) {
    player.socket.send(JSON.stringify({
      type: 'error',
      message: 'Missing room code or player name'
    }));
    return;
  }
  
  player.name = data.playerName;
  
  const room = gameManager.joinRoom(data.roomCode, player);
  
  if (!room) {
    player.socket.send(JSON.stringify({
      type: 'error',
      message: 'Room not found or full'
    }));
    return;
  }
  
  player.socket.send(JSON.stringify({
    type: 'room_joined',
    roomCode: room.code,
    gameState: gameManager.getRoomState(room),
    board: player.board
  }));
  
  broadcastRoomListUpdate();
}

function handleLeaveRoom(player: Player, data: GameMessage) {
  if (!data.roomCode) return;
  
  gameManager.leaveRoom(data.roomCode, player.id);
  broadcastRoomListUpdate();
}

function handleStartGame(player: Player, data: GameMessage) {
  if (!data.roomCode) return;
  
  const success = gameManager.startGame(data.roomCode);
  
  if (!success) {
    player.socket.send(JSON.stringify({
      type: 'error',
      message: 'Failed to start game'
    }));
  }
}

function handleCallNumber(player: Player, data: GameMessage) {
  if (!data.roomCode) return;
  
  const number = gameManager.callNumber(data.roomCode, player.id);
  
  if (number === null) {
    player.socket.send(JSON.stringify({
      type: 'error',
      message: 'Not authorized to call numbers'
    }));
  }
}

function handleClaimWin(player: Player, data: GameMessage) {
  if (!data.roomCode || !data.pattern) return;
  
  const success = gameManager.claimWin(
    data.roomCode,
    player.id,
    data.pattern
  );
  
  if (!success) {
    player.socket.send(JSON.stringify({
      type: 'error',
      message: 'Invalid win claim'
    }));
  }
}

function handleChatMessage(player: Player, data: GameMessage) {
  if (!data.roomCode || !data.message) return;
  
  gameManager.sendChatMessage(
    data.roomCode,
    player.id,
    data.message
  );
}

function broadcastRoomListUpdate() {
  const rooms = gameManager.getActiveRooms();
  const message = JSON.stringify({
    type: 'rooms_list',
    rooms
  });
  
  wss.forEach(client => {
    if (!client.isClosed) {
      client.send(message);
    }
  });
}

function generatePlayerId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

// Setup middleware
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

app.use(router.routes());
app.use(router.allowedMethods());

// Serve static files in production
app.use(async (ctx) => {
  const path = ctx.request.url.pathname;
  
  // In production, you might want to serve the frontend files
  if (path === "/" || path.startsWith("/frontend")) {
    // You can implement static file serving here
    // or use a CDN for the frontend
    ctx.response.body = "Assefa Digital Bingo API Server";
  }
});

// Start server
const PORT = Deno.env.get("PORT") || 8080;

console.log(`Server starting on port ${PORT}...`);
await app.listen({ port: Number(PORT) });
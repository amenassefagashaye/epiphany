// Assefa Digital Bingo - Real-Time Multiplayer Game
// Frontend JavaScript with WebSocket integration

class BingoGameClient {
    constructor() {
        this.socket = null;
        this.playerId = null;
        this.playerName = null;
        this.currentRoom = null;
        this.gameState = null;
        this.playerBoard = null;
        this.markedNumbers = new Set();
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 2000;
        this.autoCallInterval = null;
        this.isAutoCalling = false;
        this.soundEnabled = true;
        this.lastWinner = null;
        this.gameStartTime = null;
        
        // PRODUCTION CONFIGURATION
        this.config = {
            // Your Deno Deploy URL - adjust protocol for WebSocket
            wsUrl: this.getWebSocketUrl(),
            
            autoCallDelay: 5000, // 5 seconds
            maxPlayers: 10,
            maxRooms: 100,
            version: '1.0.0'
        };
        
        // Initialize event listeners
        this.initializeEventListeners();
    }
    
    getWebSocketUrl() {
        // Determine WebSocket URL based on environment
        if (window.location.hostname === 'localhost' || 
            window.location.hostname === '127.0.0.1') {
            // Local development
            return 'ws://localhost:8080/ws';
        } else {
            // Production - convert HTTPS to WSS for your Deno Deploy URL
            // Replace with your actual Deno Deploy URL
            const deployUrl = 'ameng-gogs-epiphany-91.deno.dev';
            return `wss://${deployUrl}/ws`;
        }
    }
    
    initializeEventListeners() {
        // DOM Content Loaded
        document.addEventListener('DOMContentLoaded', () => {
            this.initializeUI();
            this.connectWebSocket();
        });
        
        // Window before unload
        window.addEventListener('beforeunload', () => {
            this.disconnect();
        });
    }
    
    initializeUI() {
        // Initialize UI components
        this.setupLoginForm();
        this.setupGameControls();
        this.setupSoundToggle();
        this.setupRoomManagement();
    }
    
    connectWebSocket() {
        const wsUrl = this.config.wsUrl;
        
        console.log(`Connecting to WebSocket: ${wsUrl}`);
        
        try {
            this.socket = new WebSocket(wsUrl);
            
            this.socket.onopen = (event) => {
                console.log('WebSocket connection established');
                this.reconnectAttempts = 0;
                this.updateConnectionStatus('connected');
                
                // Restore previous session if available
                this.restoreSession();
            };
            
            this.socket.onmessage = (event) => {
                this.handleMessage(event.data);
            };
            
            this.socket.onclose = (event) => {
                console.log('WebSocket connection closed', event);
                this.updateConnectionStatus('disconnected');
                this.handleDisconnection();
            };
            
            this.socket.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.updateConnectionStatus('error');
            };
            
        } catch (error) {
            console.error('Failed to create WebSocket connection:', error);
            this.attemptReconnect();
        }
    }
    
    handleMessage(data) {
        try {
            const message = JSON.parse(data);
            console.log('Received message:', message);
            
            switch (message.type) {
                case 'welcome':
                    this.handleWelcome(message);
                    break;
                case 'player_joined':
                    this.handlePlayerJoined(message);
                    break;
                case 'player_left':
                    this.handlePlayerLeft(message);
                    break;
                case 'room_created':
                    this.handleRoomCreated(message);
                    break;
                case 'room_joined':
                    this.handleRoomJoined(message);
                    break;
                case 'game_started':
                    this.handleGameStarted(message);
                    break;
                case 'number_called':
                    this.handleNumberCalled(message);
                    break;
                case 'board_generated':
                    this.handleBoardGenerated(message);
                    break;
                case 'bingo':
                    this.handleBingo(message);
                    break;
                case 'game_over':
                    this.handleGameOver(message);
                    break;
                case 'error':
                    this.handleError(message);
                    break;
                case 'room_list':
                    this.handleRoomList(message);
                    break;
                case 'player_list':
                    this.handlePlayerList(message);
                    break;
                default:
                    console.warn('Unknown message type:', message.type);
            }
        } catch (error) {
            console.error('Error parsing message:', error, data);
        }
    }
    
    sendMessage(type, data = {}) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            const message = {
                type,
                playerId: this.playerId,
                playerName: this.playerName,
                timestamp: Date.now(),
                ...data
            };
            
            this.socket.send(JSON.stringify(message));
            console.log('Sent message:', message);
        } else {
            console.warn('WebSocket not ready. State:', this.socket?.readyState);
            this.attemptReconnect();
        }
    }
    
    handleDisconnection() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
            
            setTimeout(() => {
                this.connectWebSocket();
            }, this.reconnectDelay * this.reconnectAttempts);
        } else {
            console.error('Max reconnection attempts reached');
            this.showNotification('Connection lost. Please refresh the page.', 'error');
        }
    }
    
    attemptReconnect() {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            this.handleDisconnection();
        }
    }
    
    disconnect() {
        if (this.socket) {
            this.socket.close(1000, 'User disconnected');
        }
    }
    
    // Game-specific methods
    login(playerName) {
        if (!playerName.trim()) {
            this.showNotification('Please enter a player name', 'error');
            return;
        }
        
        this.playerName = playerName.trim();
        this.sendMessage('login', { playerName: this.playerName });
    }
    
    createRoom(roomName, maxPlayers = 10) {
        if (!roomName.trim()) {
            this.showNotification('Please enter a room name', 'error');
            return;
        }
        
        this.sendMessage('create_room', {
            roomName: roomName.trim(),
            maxPlayers: Math.min(maxPlayers, this.config.maxPlayers)
        });
    }
    
    joinRoom(roomId) {
        if (!roomId) {
            this.showNotification('Please select a room', 'error');
            return;
        }
        
        this.sendMessage('join_room', { roomId });
    }
    
    startGame() {
        if (this.currentRoom) {
            this.sendMessage('start_game', { roomId: this.currentRoom });
        }
    }
    
    callNumber() {
        if (this.currentRoom) {
            this.sendMessage('call_number', { roomId: this.currentRoom });
        }
    }
    
    toggleAutoCall() {
        this.isAutoCalling = !this.isAutoCalling;
        
        if (this.isAutoCalling) {
            this.autoCallInterval = setInterval(() => {
                if (this.gameState === 'playing' && this.currentRoom) {
                    this.callNumber();
                } else {
                    this.toggleAutoCall(); // Turn off if game not in progress
                }
            }, this.config.autoCallDelay);
            
            this.showNotification('Auto-call enabled', 'success');
        } else {
            clearInterval(this.autoCallInterval);
            this.autoCallInterval = null;
            this.showNotification('Auto-call disabled', 'info');
        }
        
        this.updateAutoCallButton();
    }
    
    markNumber(number) {
        if (this.gameState !== 'playing') return;
        
        if (this.markedNumbers.has(number)) {
            this.markedNumbers.delete(number);
        } else {
            this.markedNumbers.add(number);
            this.checkBingo();
        }
        
        this.updateBoardDisplay();
    }
    
    checkBingo() {
        // Implement bingo pattern checking logic here
        // This would check rows, columns, diagonals, etc.
        
        if (this.markedNumbers.size >= 5) {
            // Send bingo claim
            this.sendMessage('claim_bingo', {
                roomId: this.currentRoom,
                markedNumbers: Array.from(this.markedNumbers)
            });
        }
    }
    
    // UI Update Methods
    updateConnectionStatus(status) {
        const statusElement = document.getElementById('connection-status');
        if (statusElement) {
            statusElement.textContent = `Status: ${status}`;
            statusElement.className = `status-${status}`;
        }
    }
    
    updateAutoCallButton() {
        const button = document.getElementById('auto-call-btn');
        if (button) {
            button.textContent = this.isAutoCalling ? 'Stop Auto Call' : 'Start Auto Call';
            button.className = this.isAutoCalling ? 'btn-danger' : 'btn-success';
        }
    }
    
    updateBoardDisplay() {
        // Update the visual representation of the bingo board
        if (!this.playerBoard) return;
        
        const boardContainer = document.getElementById('bingo-board');
        if (boardContainer) {
            boardContainer.innerHTML = '';
            
            this.playerBoard.forEach((row, rowIndex) => {
                const rowElement = document.createElement('div');
                rowElement.className = 'bingo-row';
                
                row.forEach((cell, colIndex) => {
                    const cellElement = document.createElement('div');
                    cellElement.className = 'bingo-cell';
                    cellElement.textContent = cell;
                    
                    if (this.markedNumbers.has(cell)) {
                        cellElement.classList.add('marked');
                    }
                    
                    if (this.gameState === 'playing') {
                        cellElement.addEventListener('click', () => this.markNumber(cell));
                    }
                    
                    rowElement.appendChild(cellElement);
                });
                
                boardContainer.appendChild(rowElement);
            });
        }
    }
    
    showNotification(message, type = 'info') {
        // Create and show notification
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        // Play sound if enabled
        if (this.soundEnabled) {
            this.playSound(type);
        }
        
        // Remove notification after delay
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
    
    playSound(type) {
        // Play different sounds based on event type
        const audio = new Audio();
        
        switch (type) {
            case 'success':
                audio.src = 'sounds/success.mp3';
                break;
            case 'error':
                audio.src = 'sounds/error.mp3';
                break;
            case 'bingo':
                audio.src = 'sounds/bingo.mp3';
                break;
            case 'number':
                audio.src = 'sounds/number.mp3';
                break;
        }
        
        audio.play().catch(e => console.log('Audio play failed:', e));
    }
    
    // Message Handlers (implement these based on your server protocol)
    handleWelcome(message) {
        this.playerId = message.playerId;
        this.showNotification(`Welcome ${this.playerName}!`, 'success');
    }
    
    handleRoomJoined(message) {
        this.currentRoom = message.roomId;
        this.gameState = message.gameState || 'waiting';
        this.showNotification(`Joined room: ${message.roomName}`, 'success');
    }
    
    handleGameStarted(message) {
        this.gameState = 'playing';
        this.gameStartTime = Date.now();
        this.markedNumbers.clear();
        this.showNotification('Game started!', 'success');
    }
    
    handleBoardGenerated(message) {
        this.playerBoard = message.board;
        this.updateBoardDisplay();
    }
    
    handleNumberCalled(message) {
        const number = message.number;
        this.showNotification(`Number called: ${number}`, 'number');
        
        // Update called numbers display
        this.updateCalledNumbers(message.calledNumbers);
    }
    
    handleBingo(message) {
        this.lastWinner = message.winnerName;
        this.showNotification(`BINGO! Winner: ${message.winnerName}`, 'bingo');
    }
    
    // Setup methods for UI components
    setupLoginForm() {
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const playerName = document.getElementById('player-name').value;
                this.login(playerName);
            });
        }
    }
    
    setupGameControls() {
        // Auto-call button
        const autoCallBtn = document.getElementById('auto-call-btn');
        if (autoCallBtn) {
            autoCallBtn.addEventListener('click', () => this.toggleAutoCall());
        }
        
        // Call number button
        const callNumberBtn = document.getElementById('call-number-btn');
        if (callNumberBtn) {
            callNumberBtn.addEventListener('click', () => this.callNumber());
        }
        
        // Start game button
        const startGameBtn = document.getElementById('start-game-btn');
        if (startGameBtn) {
            startGameBtn.addEventListener('click', () => this.startGame());
        }
    }
    
    setupSoundToggle() {
        const soundToggle = document.getElementById('sound-toggle');
        if (soundToggle) {
            soundToggle.addEventListener('change', (e) => {
                this.soundEnabled = e.target.checked;
                localStorage.setItem('bingoSoundEnabled', this.soundEnabled);
            });
            
            // Load saved preference
            const savedSoundPref = localStorage.getItem('bingoSoundEnabled');
            if (savedSoundPref !== null) {
                this.soundEnabled = savedSoundPref === 'true';
                soundToggle.checked = this.soundEnabled;
            }
        }
    }
    
    setupRoomManagement() {
        // Create room form
        const createRoomForm = document.getElementById('create-room-form');
        if (createRoomForm) {
            createRoomForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const roomName = document.getElementById('room-name').value;
                const maxPlayers = document.getElementById('max-players').value;
                this.createRoom(roomName, parseInt(maxPlayers));
            });
        }
        
        // Refresh room list button
        const refreshRoomsBtn = document.getElementById('refresh-rooms-btn');
        if (refreshRoomsBtn) {
            refreshRoomsBtn.addEventListener('click', () => {
                this.sendMessage('get_rooms');
            });
        }
    }
    
    restoreSession() {
        // Restore player session from localStorage
        const savedPlayerId = localStorage.getItem('bingoPlayerId');
        const savedPlayerName = localStorage.getItem('bingoPlayerName');
        const savedRoomId = localStorage.getItem('bingoRoomId');
        
        if (savedPlayerId && savedPlayerName) {
            this.playerId = savedPlayerId;
            this.playerName = savedPlayerName;
            
            // Update UI
            const playerNameInput = document.getElementById('player-name');
            if (playerNameInput) {
                playerNameInput.value = this.playerName;
            }
            
            // Auto-rejoin room if previously in one
            if (savedRoomId) {
                setTimeout(() => {
                    this.sendMessage('join_room', { roomId: savedRoomId });
                }, 1000);
            }
        }
    }
    
    // Save session data to localStorage
    saveSession() {
        if (this.playerId) {
            localStorage.setItem('bingoPlayerId', this.playerId);
        }
        if (this.playerName) {
            localStorage.setItem('bingoPlayerName', this.playerName);
        }
        if (this.currentRoom) {
            localStorage.setItem('bingoRoomId', this.currentRoom);
        }
    }
}

// Initialize the game client when page loads
let bingoGame;

window.onload = function() {
    bingoGame = new BingoGameClient();
};

// Export for module usage if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BingoGameClient;
}

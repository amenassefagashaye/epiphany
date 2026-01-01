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
            // Replace with your actual Deno Deploy URL
            wsUrl: 'wss://assefa-bingo-api.deno.dev/ws', // ← CHANGE THIS TO YOUR DENO DEPLOY URL
            
            // For local development testing:
            // wsUrl: window.location.hostname === 'localhost' 
            //     ? 'ws://localhost:8080/ws'
            //     : 'wss://YOUR-PROJECT-NAME.deno.dev/ws',
            
            autoCallDelay: 5000, // 5 seconds
            maxPlayers: 10,
            maxRooms: 100,
            version: '1.0.0'
        };
        
        this.initialize();
    }
    
    initialize() {
        console.log('Initializing Assefa Digital Bingo v' + this.config.version);
        console.log('Connecting to WebSocket:', this.config.wsUrl);
        this.setupEventListeners();
        this.loadPlayerData();
        this.connectToServer();
        this.setupAutoRefresh();
    }
    
    setupEventListeners() {
        // Auto-join if we have saved room data
        const savedRoom = localStorage.getItem('bingo_last_room');
        const savedName = localStorage.getItem('bingo_player_name');
        
        if (savedRoom && savedName) {
            document.getElementById('playerName').value = savedName;
            document.getElementById('roomCode').value = savedRoom;
            document.getElementById('newPlayerName').value = savedName;
        }
        
        // Handle Enter key for chat
        document.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
                if (e.target.id === 'chatInput') {
                    this.sendChatMessage();
                }
            }
        });
        
        // Handle visibility change for reconnection
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible' && !this.socket) {
                this.connectToServer();
            }
        });
    }
    
    loadPlayerData() {
        const savedName = localStorage.getItem('bingo_player_name');
        const soundPref = localStorage.getItem('bingo_sound_enabled');
        
        if (savedName) {
            this.playerName = savedName;
            document.getElementById('playerName').value = savedName;
            document.getElementById('newPlayerName').value = savedName;
        }
        
        if (soundPref !== null) {
            this.soundEnabled = soundPref === 'true';
            this.updateSoundButton();
        }
    }
    
    savePlayerData() {
        if (this.playerName) {
            localStorage.setItem('bingo_player_name', this.playerName);
        }
        localStorage.setItem('bingo_sound_enabled', this.soundEnabled.toString());
    }
    
    async connectToServer() {
        try {
            console.log('Connecting to WebSocket:', this.config.wsUrl);
            this.updateConnectionStatus(false);
            
            this.socket = new WebSocket(this.config.wsUrl);
            
            this.socket.onopen = () => this.handleConnectionOpen();
            this.socket.onmessage = (event) => this.handleMessage(event);
            this.socket.onclose = () => this.handleConnectionClose();
            this.socket.onerror = (error) => this.handleConnectionError(error);
            
            // Add connection timeout
            setTimeout(() => {
                if (this.socket && this.socket.readyState === WebSocket.CONNECTING) {
                    console.log('WebSocket connection timeout');
                    this.showNotification('Connection timeout. Check your internet.', 'error');
                    this.socket.close();
                }
            }, 10000);
            
        } catch (error) {
            console.error('Failed to connect:', error);
            this.showNotification('Failed to connect to game server', 'error');
            this.scheduleReconnect();
        }
    }
    
    handleConnectionOpen() {
        console.log('✅ WebSocket connected successfully');
        this.reconnectAttempts = 0;
        this.updateConnectionStatus(true);
        
        // Request active rooms
        this.sendMessage({
            type: 'get_rooms'
        });
        
        // Try to reconnect to last room if we have credentials
        const lastRoom = localStorage.getItem('bingo_last_room');
        const lastName = localStorage.getItem('bingo_player_name');
        
        if (lastRoom && lastName) {
            setTimeout(() => {
                this.joinRoom(lastRoom, lastName);
            }, 1000);
        }
    }
    
    handleMessage(event) {
        try {
            const data = JSON.parse(event.data);
            console.log('📨 Received:', data.type);
            
            switch (data.type) {
                case 'player_connected':
                    this.handlePlayerConnected(data);
                    break;
                    
                case 'room_created':
                    this.handleRoomCreated(data);
                    break;
                    
                case 'room_joined':
                    this.handleRoomJoined(data);
                    break;
                    
                case 'room_update':
                    this.handleRoomUpdate(data);
                    break;
                    
                case 'game_started':
                    this.handleGameStarted(data);
                    break;
                    
                case 'number_called':
                    this.handleNumberCalled(data);
                    break;
                    
                case 'player_win':
                    this.handlePlayerWin(data);
                    break;
                    
                case 'game_update':
                    this.handleGameUpdate(data);
                    break;
                    
                case 'chat_message':
                    this.handleChatMessage(data);
                    break;
                    
                case 'player_left':
                    this.handlePlayerLeft(data);
                    break;
                    
                case 'player_joined':
                    this.handlePlayerJoined(data);
                    break;
                    
                case 'rooms_list':
                    this.handleRoomsList(data);
                    break;
                    
                case 'error':
                    this.handleError(data);
                    break;
                    
                case 'pong':
                    // Keep-alive response
                    break;
                    
                default:
                    console.warn('Unknown message type:', data.type);
            }
        } catch (error) {
            console.error('Error parsing message:', error);
        }
    }
    
    handleConnectionClose() {
        console.log('🔌 WebSocket disconnected');
        this.updateConnectionStatus(false);
        
        if (this.currentRoom) {
            this.showNotification('Connection lost. Attempting to reconnect...', 'warning');
        }
        
        this.scheduleReconnect();
    }
    
    handleConnectionError(error) {
        console.error('WebSocket error:', error);
        this.showNotification('Connection error to game server', 'error');
    }
    
    scheduleReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = this.reconnectDelay * this.reconnectAttempts;
            
            console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            
            setTimeout(() => {
                if (this.socket && this.socket.readyState === WebSocket.CLOSED) {
                    this.connectToServer();
                }
            }, delay);
        } else {
            this.showNotification('Unable to connect to game server. Please refresh the page.', 'error');
        }
    }
    
    sendMessage(data) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            try {
                this.socket.send(JSON.stringify(data));
            } catch (error) {
                console.error('Failed to send message:', error);
                this.showNotification('Failed to send message. Reconnecting...', 'error');
                this.connectToServer();
            }
        } else {
            console.error('WebSocket is not open');
            this.showNotification('Connection lost. Reconnecting...', 'warning');
            this.connectToServer();
        }
    }
    
    // Game Functions
    createRoom() {
        const playerName = document.getElementById('newPlayerName').value.trim();
        const gameType = document.getElementById('gameType').value;
        
        if (!playerName) {
            this.showNotification('Please enter your name', 'error');
            document.getElementById('newPlayerName').focus();
            return;
        }
        
        if (playerName.length < 2 || playerName.length > 20) {
            this.showNotification('Name must be 2-20 characters', 'error');
            return;
        }
        
        this.playerName = playerName;
        localStorage.setItem('bingo_player_name', playerName);
        
        this.sendMessage({
            type: 'create_room',
            playerName: playerName,
            gameType: gameType
        });
        
        this.showNotification('Creating room...', 'info');
    }
    
    joinRoom(roomCode = null, playerName = null) {
        const code = roomCode || document.getElementById('roomCode').value.trim().toUpperCase();
        const name = playerName || document.getElementById('playerName').value.trim();
        
        if (!code) {
            this.showNotification('Please enter room code', 'error');
            document.getElementById('roomCode').focus();
            return;
        }
        
        if (!name) {
            this.showNotification('Please enter your name', 'error');
            document.getElementById('playerName').focus();
            return;
        }
        
        if (name.length < 2 || name.length > 20) {
            this.showNotification('Name must be 2-20 characters', 'error');
            return;
        }
        
        this.playerName = name;
        localStorage.setItem('bingo_player_name', name);
        localStorage.setItem('bingo_last_room', code);
        
        this.sendMessage({
            type: 'join_room',
            roomCode: code,
            playerName: name
        });
        
        this.showNotification('Joining room...', 'info');
    }
    
    leaveRoom() {
        if (this.currentRoom) {
            if (confirm('Are you sure you want to leave the room?')) {
                this.sendMessage({
                    type: 'leave_room',
                    roomCode: this.currentRoom
                });
                
                this.currentRoom = null;
                this.gameState = null;
                this.playerBoard = null;
                this.markedNumbers.clear();
                this.stopAutoCall();
                
                this.showPage('pageLobby');
                this.sendMessage({ type: 'get_rooms' });
                
                this.showNotification('Left the room', 'info');
            }
        }
    }
    
    startGame() {
        if (this.currentRoom && this.gameState?.hostId === this.playerId) {
            if (this.gameState.players.length < 2) {
                this.showNotification('Need at least 2 players to start', 'warning');
                return;
            }
            
            this.sendMessage({
                type: 'start_game',
                roomCode: this.currentRoom
            });
            
            this.showNotification('Starting game...', 'info');
        }
    }
    
    callNextNumber() {
        if (this.currentRoom && this.gameState?.hostId === this.playerId) {
            this.sendMessage({
                type: 'call_number',
                roomCode: this.currentRoom
            });
        }
    }
    
    toggleAutoCall() {
        if (!this.currentRoom || this.gameState?.hostId !== this.playerId) {
            return;
        }
        
        if (this.isAutoCalling) {
            this.stopAutoCall();
            this.showNotification('Auto-call stopped', 'info');
        } else {
            this.startAutoCall();
            this.showNotification('Auto-call started', 'success');
        }
    }
    
    startAutoCall() {
        this.isAutoCalling = true;
        document.getElementById('autoCallBtn').textContent = 'Auto-call (Stop)';
        document.getElementById('autoCallBtn').classList.add('active');
        
        // Call first number immediately
        this.callNextNumber();
        
        // Set up interval
        this.autoCallInterval = setInterval(() => {
            if (this.gameState?.status === 'playing') {
                this.callNextNumber();
            } else {
                this.stopAutoCall();
            }
        }, this.config.autoCallDelay);
    }
    
    stopAutoCall() {
        this.isAutoCalling = false;
        if (this.autoCallInterval) {
            clearInterval(this.autoCallInterval);
            this.autoCallInterval = null;
        }
        
        document.getElementById('autoCallBtn').textContent = 'Auto-call';
        document.getElementById('autoCallBtn').classList.remove('active');
    }
    
    claimWin() {
        if (this.currentRoom && this.checkWinCondition()) {
            const pattern = this.detectWinPattern();
            
            this.sendMessage({
                type: 'claim_win',
                roomCode: this.currentRoom,
                playerId: this.playerId,
                pattern: pattern
            });
            
            // Disable claim button temporarily
            document.getElementById('claimWinBtn').disabled = true;
            setTimeout(() => {
                if (document.getElementById('claimWinBtn')) {
                    document.getElementById('claimWinBtn').disabled = !this.checkWinCondition();
                }
            }, 5000);
        } else {
            this.showNotification('Not ready to win yet. Complete the pattern first.', 'warning');
        }
    }
    
    sendChatMessage() {
        const input = document.getElementById('chatInput');
        const message = input.value.trim();
        
        if (!message) return;
        
        if (message.length > 200) {
            this.showNotification('Message too long (max 200 chars)', 'warning');
            return;
        }
        
        if (this.currentRoom) {
            this.sendMessage({
                type: 'chat_message',
                roomCode: this.currentRoom,
                playerId: this.playerId,
                message: message
            });
            
            input.value = '';
            input.focus();
        }
    }
    
    sendQuickChat(message) {
        if (this.currentRoom) {
            this.sendMessage({
                type: 'chat_message',
                roomCode: this.currentRoom,
                playerId: this.playerId,
                message: message
            });
        }
    }
    
    copyRoomCode() {
        if (this.currentRoom) {
            navigator.clipboard.writeText(this.currentRoom)
                .then(() => {
                    this.showNotification('Room code copied!', 'success');
                })
                .catch(err => {
                    console.error('Failed to copy:', err);
                    this.showNotification('Could not copy room code', 'error');
                });
        }
    }
    
    toggleSound() {
        this.soundEnabled = !this.soundEnabled;
        this.updateSoundButton();
        this.savePlayerData();
        
        const message = this.soundEnabled 
            ? 'Sound enabled 🔊' 
            : 'Sound muted 🔇';
        this.showNotification(message, 'info');
    }
    
    updateSoundButton() {
        const button = document.querySelector('.btn-sound');
        if (button) {
            button.textContent = this.soundEnabled ? '🔊' : '🔇';
        }
    }
    
    playSound(type) {
        if (!this.soundEnabled) return;
        
        try {
            const audio = document.getElementById(type + 'Sound');
            if (audio) {
                audio.currentTime = 0;
                audio.play().catch(() => {});
            }
        } catch (error) {
            console.log('Audio play error:', error);
        }
    }
    
    // UI Helper Functions
    showNotification(message, type = 'info') {
        const modal = document.getElementById('notificationModal');
        const messageElement = document.getElementById('notificationMessage');
        const iconElement = document.getElementById('notificationIcon');
        
        const icons = {
            'info': 'ℹ️',
            'success': '✅',
            'warning': '⚠️',
            'error': '❌'
        };
        
        iconElement.textContent = icons[type] || 'ℹ️';
        messageElement.textContent = message;
        modal.classList.add('active');
        
        if (type === 'error' && this.soundEnabled) {
            this.playSound('error');
        }
        
        if (type !== 'error') {
            setTimeout(() => {
                this.closeNotification();
            }, 3000);
        }
    }
    
    closeNotification() {
        document.getElementById('notificationModal').classList.remove('active');
    }
    
    showPage(pageId) {
        document.querySelectorAll('.page-container').forEach(page => {
            page.classList.remove('active');
        });
        document.getElementById(pageId).classList.add('active');
        
        // Update page title
        const titles = {
            'pageLobby': 'Assefa Digital Bingo - Lobby',
            'pageRoom': `Room ${this.currentRoom || ''} - Assefa Digital Bingo`,
            'pageGame': `Game ${this.currentRoom || ''} - Assefa Digital Bingo`
        };
        document.title = titles[pageId] || 'Assefa Digital Bingo';
    }
    
    updateConnectionStatus(connected) {
        const statusElement = document.getElementById('connectionStatus');
        const dot = statusElement.querySelector('.status-dot');
        const text = statusElement.querySelector('span');
        
        if (connected) {
            statusElement.classList.add('connected');
            text.textContent = 'Connected to game server ✓';
        } else {
            statusElement.classList.remove('connected');
            text.textContent = 'Disconnected - Reconnecting...';
        }
    }
    
    // Message Handlers
    handlePlayerConnected(data) {
        this.playerId = data.playerId;
        console.log(`Player connected with ID: ${this.playerId}`);
    }
    
    handleRoomCreated(data) {
        this.currentRoom = data.roomCode;
        this.gameState = data.gameState;
        
        this.showPage('pageRoom');
        this.updateRoomUI(data);
        
        this.showNotification(`Room ${data.roomCode} created!`, 'success');
        this.playSound('join');
    }
    
    handleRoomJoined(data) {
        this.currentRoom = data.roomCode;
        this.gameState = data.gameState;
        this.playerBoard = data.board;
        
        this.showPage('pageRoom');
        this.updateRoomUI(data);
        
        this.playSound('join');
        this.showNotification(`Joined room ${data.roomCode}!`, 'success');
        
        // Add welcome message
        this.addChatMessage('System', `Welcome to the room, ${this.playerName}!`, true);
    }
    
    handleRoomUpdate(data) {
        this.gameState = data.gameState;
        this.updateRoomUI(data);
    }
    
    handleGameStarted(data) {
        this.gameState = data.gameState;
        this.playerBoard = data.board;
        this.markedNumbers.clear();
        this.gameStartTime = new Date();
        
        this.showPage('pageGame');
        this.updateGameUI(data);
        
        this.showNotification('Game started! 🎮', 'success');
        this.playSound('join');
        
        this.addChatMessage('System', 'Game started! Good luck!', true);
    }
    
    handleNumberCalled(data) {
        const number = data.number;
        const caller = data.callerName;
        
        document.getElementById('currentNumber').textContent = number;
        document.getElementById('callerName').textContent = caller;
        document.getElementById('calledCount').textContent = data.calledNumbers?.length || 0;
        
        this.addCalledNumber(number);
        this.playSound('call');
        this.markNumberOnBoard(number);
        
        if (this.isSpecialNumber(number)) {
            this.addChatMessage('System', `Special number called: ${number}!`, true);
        }
    }
    
    handlePlayerWin(data) {
        this.showWinnerModal(data);
        
        this.addWinnerToList(data);
        
        if (this.gameState) {
            this.gameState.winners = this.gameState.winners || [];
            this.gameState.winners.push(data);
        }
        
        const winMessage = data.playerId === this.playerId
            ? `🎉 ${data.playerName} (YOU) won with pattern: ${this.getWinPatternName(data.pattern)} 🎉`
            : `🏆 ${data.playerName} won with pattern: ${this.getWinPatternName(data.pattern)} 🏆`;
        
        this.addChatMessage('System', winMessage, true);
    }
    
    handleGameUpdate(data) {
        this.gameState = data.gameState;
        this.updateGameUI(data);
    }
    
    handleChatMessage(data) {
        this.addChatMessage(data.playerName, data.message, data.isSystem);
    }
    
    handlePlayerLeft(data) {
        this.showNotification(`${data.playerName} left the room`, 'info');
        this.addChatMessage('System', `${data.playerName} left the room`, true);
    }
    
    handlePlayerJoined(data) {
        this.showNotification(`${data.player.name} joined the room`, 'info');
        this.addChatMessage('System', `${data.player.name} joined the room`, true);
    }
    
    handleRoomsList(data) {
        this.updateRoomsList(data.rooms);
    }
    
    handleError(data) {
        this.showNotification(data.message, 'error');
        this.playSound('error');
    }
    
    // Utility Functions
    markNumberOnBoard(number) {
        const cells = document.querySelectorAll(`[data-number="${number}"]`);
        cells.forEach(cell => {
            if (!cell.classList.contains('marked')) {
                cell.classList.add('marked');
                this.markedNumbers.add(number);
                cell.style.animation = 'none';
                setTimeout(() => {
                    cell.style.animation = 'pulse 0.5s';
                }, 10);
            }
        });
        
        this.updateBoardStats();
        this.checkWinCondition();
    }
    
    checkWinCondition() {
        if (!this.playerBoard || !this.gameState || this.gameState.status !== 'playing') {
            return false;
        }
        
        const pattern = this.gameState.winPattern;
        const isWin = this.checkPatternWin(pattern);
        
        const centerCell = document.querySelector('.board-cell.center-cell');
        if (centerCell) {
            if (isWin) {
                centerCell.classList.add('winner-ready');
                centerCell.textContent = '🎉';
                centerCell.title = 'Click to claim win!';
            } else {
                centerCell.classList.remove('winner-ready');
                centerCell.textContent = '★';
                centerCell.title = 'Free space';
            }
        }
        
        document.getElementById('claimWinBtn').disabled = !isWin;
        return isWin;
    }
    
    checkPatternWin(pattern) {
        const totalCells = document.querySelectorAll('.board-cell:not(.blank-cell)').length;
        const markedCount = this.markedNumbers.size;
        
        switch(pattern) {
            case 'full-house':
                const freeCells = document.querySelectorAll('.board-cell[data-free="true"]').length;
                return markedCount >= (totalCells - freeCells);
            case 'one-line':
                return this.checkLineWin(1);
            case 'two-lines':
                return this.checkLineWin(2);
            default:
                return markedCount >= totalCells * 0.8;
        }
    }
    
    checkLineWin(requiredLines) {
        const board = document.getElementById('gameBoard');
        if (!board) return false;
        
        const gameType = this.gameState.gameType;
        let rows = 5, cols = 5;
        
        if (gameType === '90ball') {
            rows = 3; cols = 9;
        } else if (gameType === '30ball') {
            rows = 3; cols = 3;
        }
        
        let completedLines = 0;
        
        for (let row = 0; row < rows; row++) {
            let rowComplete = true;
            for (let col = 0; col < cols; col++) {
                const index = row * cols + col;
                const cell = board.children[index];
                if (cell && !cell.classList.contains('marked') && !cell.classList.contains('blank-cell') && !cell.dataset.free) {
                    rowComplete = false;
                    break;
                }
            }
            if (rowComplete) completedLines++;
        }
        
        return completedLines >= requiredLines;
    }
    
    detectWinPattern() {
        if (this.checkLineWin(1)) return 'one-line';
        if (this.checkLineWin(2)) return 'two-lines';
        return 'full-house';
    }
    
    getWinPatternName(pattern) {
        const patterns = {
            'full-house': 'Full House',
            'one-line': 'One Line',
            'two-lines': 'Two Lines',
            'x-pattern': 'X Pattern',
            'four-corners': 'Four Corners',
            'diagonal': 'Diagonal'
        };
        return patterns[pattern] || pattern;
    }
    
    getGameTypeName(gameType) {
        const types = {
            '75ball': '75-Bingo',
            '90ball': '90-Bingo',
            '30ball': '30-Bingo',
            'pattern': 'Pattern Bingo',
            '50ball': '50-Bingo',
            'coverall': 'Coverall'
        };
        return types[gameType] || gameType;
    }
    
    getColorFromName(name) {
        const colors = ['#0d47a1', '#1a237e', '#311b92', '#4a148c', '#880e4f', '#b71c1c'];
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        return colors[Math.abs(hash) % colors.length];
    }
    
    isSpecialNumber(number) {
        return number === 7 || number === 11 || number === 22 || number === 33 || number === 44 || number === 55 || number === 66 || number === 77;
    }
    
    addChatMessage(sender, message, isSystem = false) {
        const container = document.getElementById('chatMessages');
        const element = document.createElement('div');
        element.className = `chat-message ${isSystem ? 'system' : ''}`;
        
        const time = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        
        if (isSystem) {
            element.innerHTML = `<span class="time">[${time}]</span> ${message}`;
        } else {
            element.innerHTML = `<span class="sender">${sender}:</span> ${message} <span class="time">[${time}]</span>`;
        }
        
        container.appendChild(element);
        container.scrollTop = container.scrollHeight;
    }
    
    addCalledNumber(number) {
        const container = document.getElementById('calledNumbers');
        const element = document.createElement('div');
        element.className = 'called-number';
        element.textContent = number;
        container.appendChild(element);
        
        const numbers = container.children;
        if (numbers.length > 10) {
            container.removeChild(numbers[0]);
        }
    }
    
    updateRoomUI(data) {
        if (!this.gameState) return;
        
        document.getElementById('roomName').textContent = `${this.getGameTypeName(this.gameState.gameType)} - ${this.playerName}'s Room`;
        document.getElementById('roomCodeDisplay').textContent = this.currentRoom;
        document.getElementById('playerCount').textContent = this.gameState.players.length;
        document.getElementById('roomStatus').textContent = this.gameState.status === 'playing' ? 'Playing' : 'Waiting';
        document.getElementById('gameTypeDisplay').textContent = this.getGameTypeName(this.gameState.gameType);
        
        const playersList = document.getElementById('playersList');
        playersList.innerHTML = '';
        
        if (this.gameState.players.length === 0) {
            playersList.innerHTML = '<div class="no-players">No players yet</div>';
        } else {
            this.gameState.players.forEach(player => {
                const playerItem = document.createElement('div');
                playerItem.className = 'player-item';
                
                const isHost = player.id === this.gameState.hostId;
                const isCurrentPlayer = player.id === this.playerId;
                
                playerItem.innerHTML = `
                    <div class="player-avatar" style="background: ${this.getColorFromName(player.name)}">
                        ${player.name.charAt(0).toUpperCase()}
                    </div>
                    <div class="player-info">
                        <div class="player-name ${isCurrentPlayer ? 'amharic-text' : ''}">
                            ${player.name} ${isCurrentPlayer ? '(You)' : ''}
                        </div>
                        <div class="player-status">
                            ${isHost ? '<span class="player-host">Host</span>' : 'Player'}
                        </div>
                    </div>
                `;
                playersList.appendChild(playerItem);
            });
        }
        
        const isHost = this.gameState.hostId === this.playerId;
        const isGameActive = this.gameState.status === 'playing';
        
        document.getElementById('startGameBtn').disabled = isGameActive || !isHost;
        document.getElementById('callNumberBtn').disabled = !isGameActive || !isHost;
        document.getElementById('autoCallBtn').disabled = !isGameActive || !isHost;
        document.getElementById('claimWinBtn').disabled = true;
        
        if (this.gameState.calledNumbers) {
            document.getElementById('calledCount').textContent = this.gameState.calledNumbers.length;
            this.updateCalledNumbersDisplay();
        }
        
        document.getElementById('autoCallBtn').textContent = this.isAutoCalling 
            ? 'Auto-call (Stop)'
            : 'Auto-call';
            
        if (this.isAutoCalling) {
            document.getElementById('autoCallBtn').classList.add('active');
        } else {
            document.getElementById('autoCallBtn').classList.remove('active');
        }
    }
    
    updateGameUI(data) {
        if (!this.gameState) return;
        
        document.getElementById('gameRoomName').textContent = `${this.getGameTypeName(this.gameState.gameType)} - ${this.currentRoom}`;
        document.getElementById('gameStatus').textContent = this.gameState.status === 'playing' ? 'Playing' : 'Waiting';
        document.getElementById('playerBoardTitle').textContent = `${this.playerName}'s Board`;
        document.getElementById('winPattern').textContent = this.getWinPatternName(this.gameState.winPattern);
        
        if (this.playerBoard && !document.querySelector('.board-cell:not(.loading-board)')) {
            this.generateGameBoard();
        }
        
        this.updateBoardStats();
        
        if (this.gameState.calledNumbers) {
            document.getElementById('calledCount').textContent = this.gameState.calledNumbers.length;
            this.updateCalledNumbersDisplay();
        }
        
        if (this.gameState.winners) {
            this.updateWinnersList();
        }
        
        this.updateGameStats();
        document.getElementById('claimWinBtn').disabled = !this.checkWinCondition();
    }
    
    generateGameBoard() {
        const boardElement = document.getElementById('gameBoard');
        boardElement.innerHTML = '';
        
        if (!this.playerBoard) {
            boardElement.innerHTML = '<div class="loading-board">Loading board...</div>';
            return;
        }
        
        const gameType = this.gameState.gameType;
        boardElement.className = `game-board board-${gameType}`;
        
        if (gameType === '75ball' || gameType === 'pattern' || gameType === '50ball') {
            this.generate75BallBoard(this.playerBoard);
        } else if (gameType === '90ball') {
            this.generate90BallBoard(this.playerBoard);
        } else if (gameType === '30ball') {
            this.generate30BallBoard(this.playerBoard);
        } else if (gameType === 'coverall') {
            this.generateCoverallBoard(this.playerBoard);
        }
    }
    
    generate75BallBoard(boardData) {
        const boardElement = document.getElementById('gameBoard');
        const letters = ['B', 'I', 'N', 'G', 'O'];
        
        for (let row = 0; row < 5; row++) {
            for (let col = 0; col < 5; col++) {
                if (row === 2 && col === 2) {
                    const centerCell = document.createElement('div');
                    centerCell.className = 'board-cell center-cell';
                    centerCell.textContent = '★';
                    centerCell.dataset.free = 'true';
                    centerCell.onclick = () => {
                        if (this.gameState.status === 'playing' && this.checkWinCondition()) {
                            this.claimWin();
                        }
                    };
                    boardElement.appendChild(centerCell);
                    continue;
                }
                
                const number = boardData?.[row]?.[col];
                if (number) {
                    const cell = document.createElement('div');
                    cell.className = 'board-cell';
                    cell.textContent = number;
                    cell.dataset.number = number;
                    
                    if (this.markedNumbers.has(number)) {
                        cell.classList.add('marked');
                    }
                    
                    cell.onclick = () => this.toggleMark(number, cell);
                    boardElement.appendChild(cell);
                }
            }
        }
    }
    
    generate90BallBoard(boardData) {
        const boardElement = document.getElementById('gameBoard');
        
        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 9; col++) {
                const number = boardData[row]?.[col];
                const cell = document.createElement('div');
                cell.className = 'board-cell';
                
                if (number) {
                    cell.textContent = number;
                    cell.dataset.number = number;
                    
                    if (this.markedNumbers.has(number)) {
                        cell.classList.add('marked');
                    }
                    
                    cell.onclick = () => this.toggleMark(number, cell);
                } else {
                    cell.classList.add('blank-cell');
                    cell.textContent = '✗';
                }
                
                boardElement.appendChild(cell);
            }
        }
    }
    
    generate30BallBoard(boardData) {
        const boardElement = document.getElementById('gameBoard');
        
        for (let i = 0; i < 9; i++) {
            const number = boardData[i];
            const cell = document.createElement('div');
            cell.className = 'board-cell';
            cell.textContent = number;
            cell.dataset.number = number;
            
            if (this.markedNumbers.has(number)) {
                cell.classList.add('marked');
            }
            
            cell.onclick = () => this.toggleMark(number, cell);
            boardElement.appendChild(cell);
        }
    }
    
    generateCoverallBoard(boardData) {
        const boardElement = document.getElementById('gameBoard');
        
        for (let i = 0; i < 45; i++) {
            const number = boardData[i];
            const cell = document.createElement('div');
            cell.className = 'board-cell';
            cell.textContent = number;
            cell.dataset.number = number;
            
            if (this.markedNumbers.has(number)) {
                cell.classList.add('marked');
            }
            
            cell.onclick = () => this.toggleMark(number, cell);
            boardElement.appendChild(cell);
        }
    }
    
    toggleMark(number, cell) {
        if (this.gameState?.status !== 'playing') return;
        
        if (cell.classList.contains('marked')) {
            cell.classList.remove('marked');
            this.markedNumbers.delete(number);
        } else {
            cell.classList.add('marked');
            this.markedNumbers.add(number);
            this.playSound('mark');
        }
        
        this.updateBoardStats();
        this.checkWinCondition();
    }
    
    updateBoardStats() {
        const cells = document.querySelectorAll('.board-cell:not(.blank-cell)');
        const totalCells = cells.length;
        const markedCount = this.markedNumbers.size;
        const remainingCount = totalCells - markedCount;
        const percentage = totalCells > 0 ? Math.round((markedCount / totalCells) * 100) : 0;
        
        document.getElementById('markedCount').textContent = markedCount;
        document.getElementById('remainingCount').textContent = remainingCount;
        document.getElementById('percentage').textContent = `${percentage}%`;
    }
    
    updateGameStats() {
        if (!this.gameState) return;
        
        document.getElementById('gamePlayerCount').textContent = this.gameState.players.length;
        
        if (this.gameStartTime) {
            const elapsed = Math.floor((new Date() - this.gameStartTime) / 1000);
            const minutes = Math.floor(elapsed / 60);
            const seconds = elapsed % 60;
            document.getElementById('gameStartTime').textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }
        
        if (this.gameState.winners) {
            document.getElementById('winnersCount').textContent = this.gameState.winners.length;
        }
    }
    
    updateRoomsList(rooms) {
        const container = document.getElementById('roomList');
        const countElement = document.getElementById('activeRoomsCount');
        
        if (!rooms || rooms.length === 0) {
            container.innerHTML = '<div class="loading-rooms">No active rooms</div>';
            countElement.textContent = '0';
            return;
        }
        
        countElement.textContent = rooms.length.toString();
        container.innerHTML = '';
        
        rooms.forEach(room => {
            const element = document.createElement('div');
            element.className = 'room-item';
            element.onclick = () => {
                document.getElementById('roomCode').value = room.code;
                document.getElementById('playerName').focus();
            };
            
            element.innerHTML = `
                <div class="room-item-header">
                    <div class="room-name">${this.getGameTypeName(room.gameType)} - ${room.hostName}</div>
                    <div class="room-players">${room.playerCount}/10</div>
                </div>
                <div class="room-info">
                    Code: ${room.code}<br>
                    Status: ${room.status === 'waiting' ? 'Waiting' : 'Playing'}
                </div>
            `;
            container.appendChild(element);
        });
    }
    
    updateWinnersList() {
        const container = document.getElementById('winnersList');
        if (!this.gameState?.winners || this.gameState.winners.length === 0) {
            container.innerHTML = '<div class="no-winners">No winners yet</div>';
            return;
        }
        
        container.innerHTML = '';
        this.gameState.winners.forEach(winner => {
            const element = document.createElement('div');
            element.className = 'winner-item';
            
            element.innerHTML = `
                <div class="winner-avatar" style="background: ${this.getColorFromName(winner.playerName)}">
                    ${winner.playerName.charAt(0).toUpperCase()}
                </div>
                <div class="winner-info">
                    <div class="winner-name">${winner.playerName}</div>
                    <div class="winner-pattern">${this.getWinPatternName(winner.pattern)}</div>
                </div>
            `;
            container.appendChild(element);
        });
    }
    
    updateCalledNumbersDisplay() {
        const container = document.getElementById('calledNumbers');
        if (!this.gameState?.calledNumbers) return;
        
        container.innerHTML = '';
        this.gameState.calledNumbers.slice(-10).forEach(number => {
            const element = document.createElement('div');
            element.className = 'called-number';
            element.textContent = number;
            container.appendChild(element);
        });
    }
    
    addWinnerToList(winner) {
        const container = document.getElementById('winnersList');
        const element = document.createElement('div');
        element.className = 'winner-item';
        
        element.innerHTML = `
            <div class="winner-avatar" style="background: ${this.getColorFromName(winner.playerName)}">
                ${winner.playerName.charAt(0).toUpperCase()}
            </div>
            <div class="winner-info">
                <div class="winner-name">${winner.playerName}</div>
                <div class="winner-pattern">${this.getWinPatternName(winner.pattern)}</div>
            </div>
        `;
        
        container.insertBefore(element, container.firstChild);
        
        const winners = container.children;
        if (winners.length > 5) {
            container.removeChild(winners[5]);
        }
    }
    
    showWinnerModal(winnerInfo) {
        const modal = document.getElementById('winnerModal');
        const winnerInfoElement = document.getElementById('winnerInfo');
        const patternElement = document.getElementById('modalWinPattern');
        const amountElement = document.getElementById('modalWinAmount');
        
        const isCurrentPlayer = winnerInfo.playerId === this.playerId;
        const winnerText = isCurrentPlayer 
            ? `🎉 YOU WON! 🎉`
            : `🏆 ${winnerInfo.playerName} WON! 🏆`;
        
        winnerInfoElement.innerHTML = `<h3>${winnerText}</h3>`;
        patternElement.textContent = `Pattern: ${this.getWinPatternName(winnerInfo.pattern)}`;
        
        if (winnerInfo.prize) {
            amountElement.textContent = `Prize: ${winnerInfo.prize.toLocaleString()} Birr`;
        } else {
            amountElement.textContent = 'Congratulations!';
        }
        
        modal.classList.add('active');
        this.playSound('win');
        this.lastWinner = winnerInfo;
    }
    
    closeWinnerModal() {
        document.getElementById('winnerModal').classList.remove('active');
    }
    
    shareWin() {
        if (!this.lastWinner || !navigator.share) return;
        
        const isCurrentPlayer = this.lastWinner.playerId === this.playerId;
        const shareText = isCurrentPlayer
            ? `🎉 I won at Assefa Digital Bingo! Pattern: ${this.getWinPatternName(this.lastWinner.pattern)} 🎉`
            : `🏆 ${this.lastWinner.playerName} won at Assefa Digital Bingo! 🏆`;
        
        navigator.share({
            title: 'Assefa Digital Bingo',
            text: shareText,
            url: window.location.href
        }).catch(err => console.log('Share failed:', err));
    }
    
    markAllCalled() {
        if (!this.gameState?.calledNumbers || !this.playerBoard) return;
        
        let markedCount = 0;
        this.gameState.calledNumbers.forEach(number => {
            if (!this.markedNumbers.has(number)) {
                this.markNumberOnBoard(number);
                markedCount++;
            }
        });
        
        if (markedCount > 0) {
            this.showNotification(`Marked ${markedCount} numbers`, 'success');
            this.playSound('mark');
        }
    }
    
    clearAllMarks() {
        if (this.markedNumbers.size === 0) return;
        
        if (confirm('Clear all marks?')) {
            this.markedNumbers.clear();
            this.updateBoardUI();
            this.updateBoardStats();
            this.showNotification('All marks cleared', 'info');
        }
    }
    
    refreshRooms() {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.sendMessage({ type: 'get_rooms' });
            this.showNotification('Refreshing rooms...', 'info');
        }
    }
    
    setupAutoRefresh() {
        setInterval(() => {
            if (this.socket && this.socket.readyState === WebSocket.OPEN && !this.currentRoom) {
                this.sendMessage({ type: 'get_rooms' });
            }
        }, 30000);
    }
    
    returnToLobby() {
        this.showPage('pageLobby');
        this.sendMessage({ type: 'get_rooms' });
    }
}

// Initialize game client when page loads
let gameClient;

document.addEventListener('DOMContentLoaded', () => {
    gameClient = new BingoGameClient();
    
    // Expose functions to global scope
    window.joinRoom = () => gameClient.joinRoom();
    window.createRoom = () => gameClient.createRoom();
    window.leaveRoom = () => gameClient.leaveRoom();
    window.startGame = () => gameClient.startGame();
    window.callNextNumber = () => gameClient.callNextNumber();
    window.claimWin = () => gameClient.claimWin();
    window.sendChatMessage = () => gameClient.sendChatMessage();
    window.closeWinnerModal = () => gameClient.closeWinnerModal();
    window.closeNotification = () => gameClient.closeNotification();
    window.returnToLobby = () => gameClient.returnToLobby();
    window.toggleAutoCall = () => gameClient.toggleAutoCall();
    window.copyRoomCode = () => gameClient.copyRoomCode();
    window.toggleSound = () => gameClient.toggleSound();
    window.refreshRooms = () => gameClient.refreshRooms();
    window.sendQuickChat = (message) => gameClient.sendQuickChat(message);
    window.markAllCalled = () => gameClient.markAllCalled();
    window.clearAllMarks = () => gameClient.clearAllMarks();
    window.shareWin = () => gameClient.shareWin();
    
    // Handle chat input enter key
    document.getElementById('chatInput')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            gameClient.sendChatMessage();
        }
    });
});

// Real-Time Communication Bingo Game - Frontend

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
        
        this.initialize();
    }
    
    initialize() {
        this.setupEventListeners();
        this.connectToServer();
        this.loadPlayerData();
    }
    
    setupEventListeners() {
        // Auto-join if we have saved room data
        const savedRoom = localStorage.getItem('bingo_last_room');
        const savedName = localStorage.getItem('bingo_player_name');
        
        if (savedRoom && savedName) {
            document.getElementById('playerName').value = savedName;
            document.getElementById('roomCode').value = savedRoom;
        }
    }
    
    async connectToServer() {
        try {
            // For local development
            const wsUrl = window.location.hostname === 'localhost' 
                ? 'ws://localhost:8080/ws'
                : 'wss://your-deno-server.deno.dev/ws'; // Replace with your Deno deploy URL
            
            this.socket = new WebSocket(wsUrl);
            
            this.socket.onopen = () => this.handleConnectionOpen();
            this.socket.onmessage = (event) => this.handleMessage(event);
            this.socket.onclose = () => this.handleConnectionClose();
            this.socket.onerror = (error) => this.handleConnectionError(error);
            
        } catch (error) {
            console.error('Failed to connect:', error);
            this.showNotification('Failed to connect to server', true);
            this.scheduleReconnect();
        }
    }
    
    handleConnectionOpen() {
        console.log('Connected to server');
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
            console.log('Received:', data);
            
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
                    
                case 'rooms_list':
                    this.handleRoomsList(data);
                    break;
                    
                case 'error':
                    this.handleError(data);
                    break;
                    
                default:
                    console.warn('Unknown message type:', data.type);
            }
        } catch (error) {
            console.error('Error parsing message:', error);
        }
    }
    
    handleConnectionClose() {
        console.log('Disconnected from server');
        this.updateConnectionStatus(false);
        this.scheduleReconnect();
    }
    
    handleConnectionError(error) {
        console.error('WebSocket error:', error);
        this.showNotification('Connection error', true);
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
        }
    }
    
    sendMessage(data) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify(data));
        } else {
            console.error('WebSocket is not open');
        }
    }
    
    // UI Helper Functions
    updateConnectionStatus(connected) {
        const statusElement = document.getElementById('connectionStatus');
        const dot = statusElement.querySelector('.status-dot');
        const text = statusElement.querySelector('span');
        
        if (connected) {
            statusElement.classList.add('connected');
            text.textContent = 'Connected to server';
        } else {
            statusElement.classList.remove('connected');
            text.textContent = 'Disconnected - Reconnecting...';
        }
    }
    
    showNotification(message, isError = false) {
        const modal = document.getElementById('notificationModal');
        const messageElement = document.getElementById('notificationMessage');
        
        messageElement.textContent = message;
        messageElement.style.color = isError ? 'var(--red)' : 'var(--green)';
        
        modal.classList.add('active');
        
        if (!isError) {
            setTimeout(() => {
                this.closeNotification();
            }, 3000);
        }
    }
    
    closeNotification() {
        document.getElementById('notificationModal').classList.remove('active');
    }
    
    showWinnerModal(winnerInfo) {
        const modal = document.getElementById('winnerModal');
        const winnerInfoElement = document.getElementById('winnerInfo');
        const patternElement = document.getElementById('modalWinPattern');
        const amountElement = document.getElementById('modalWinAmount');
        
        winnerInfoElement.innerHTML = `
            <h3>${winnerInfo.playerName}</h3>
            <p>ሰራ! 🎉</p>
        `;
        patternElement.textContent = winnerInfo.pattern;
        amountElement.textContent = winnerInfo.prize ? `${winnerInfo.prize} ብር` : '';
        
        modal.classList.add('active');
        
        // Play win sound
        const winSound = document.getElementById('winSound');
        winSound.currentTime = 0;
        winSound.play().catch(() => {});
    }
    
    closeWinnerModal() {
        document.getElementById('winnerModal').classList.remove('active');
    }
    
    // Room Management
    createRoom() {
        const playerName = document.getElementById('newPlayerName').value.trim();
        const gameType = document.getElementById('gameType').value;
        
        if (!playerName) {
            this.showNotification('እባክዎ ስምዎን ያስገቡ', true);
            return;
        }
        
        this.playerName = playerName;
        localStorage.setItem('bingo_player_name', playerName);
        
        this.sendMessage({
            type: 'create_room',
            playerName: playerName,
            gameType: gameType
        });
    }
    
    joinRoom(roomCode = null, playerName = null) {
        const code = roomCode || document.getElementById('roomCode').value.trim().toUpperCase();
        const name = playerName || document.getElementById('playerName').value.trim();
        
        if (!code || !name) {
            this.showNotification('እባክዎ ስም እና የክፍሉን ኮድ ያስገቡ', true);
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
    }
    
    leaveRoom() {
        if (this.currentRoom) {
            this.sendMessage({
                type: 'leave_room',
                roomCode: this.currentRoom
            });
            
            this.currentRoom = null;
            this.gameState = null;
            this.playerBoard = null;
            this.markedNumbers.clear();
            
            this.showPage('pageLobby');
            
            // Update rooms list
            this.sendMessage({ type: 'get_rooms' });
        }
    }
    
    startGame() {
        if (this.currentRoom) {
            this.sendMessage({
                type: 'start_game',
                roomCode: this.currentRoom
            });
        }
    }
    
    callNextNumber() {
        if (this.currentRoom && this.gameState?.isHost) {
            this.sendMessage({
                type: 'call_number',
                roomCode: this.currentRoom
            });
        }
    }
    
    claimWin() {
        if (this.currentRoom && this.checkWinCondition()) {
            this.sendMessage({
                type: 'claim_win',
                roomCode: this.currentRoom,
                playerId: this.playerId,
                pattern: this.detectWinPattern()
            });
        } else {
            this.showNotification('ለማሸነፍ አሁንም አይገባም', true);
        }
    }
    
    sendChatMessage() {
        const input = document.getElementById('chatInput');
        const message = input.value.trim();
        
        if (message && this.currentRoom) {
            this.sendMessage({
                type: 'chat_message',
                roomCode: this.currentRoom,
                playerId: this.playerId,
                message: message
            });
            
            input.value = '';
        }
    }
    
    // Message Handlers
    handlePlayerConnected(data) {
        this.playerId = data.playerId;
        console.log(`Connected as player ${this.playerId}`);
    }
    
    handleRoomCreated(data) {
        this.currentRoom = data.roomCode;
        this.gameState = data.gameState;
        
        this.showPage('pageRoom');
        this.updateRoomUI(data);
        
        this.showNotification(`ክፍል ${data.roomCode} በተሳካ ሁኔታ ተፈጥሯል!`);
    }
    
    handleRoomJoined(data) {
        this.currentRoom = data.roomCode;
        this.gameState = data.gameState;
        this.playerBoard = data.board;
        
        this.showPage('pageRoom');
        this.updateRoomUI(data);
        
        // Play join sound
        const joinSound = document.getElementById('joinSound');
        joinSound.currentTime = 0;
        joinSound.play().catch(() => {});
    }
    
    handleRoomUpdate(data) {
        this.gameState = data.gameState;
        this.updateRoomUI(data);
    }
    
    handleGameStarted(data) {
        this.gameState = data.gameState;
        this.playerBoard = data.board;
        this.markedNumbers.clear();
        
        this.showPage('pageGame');
        this.updateGameUI(data);
        
        this.showNotification('ጨዋታው ጀመረ! 🎮');
    }
    
    handleNumberCalled(data) {
        const number = data.number;
        const caller = data.callerName;
        
        // Update UI
        document.getElementById('currentNumber').textContent = number;
        document.getElementById('callerName').textContent = caller;
        document.getElementById('calledCount').textContent = this.gameState?.calledNumbers?.length || 0;
        
        // Add to called numbers display
        this.addCalledNumber(number);
        
        // Play sound
        const callSound = document.getElementById('callSound');
        callSound.currentTime = 0;
        callSound.play().catch(() => {});
        
        // Mark on board if player has this number
        this.markNumberOnBoard(number);
    }
    
    handlePlayerWin(data) {
        this.showWinnerModal(data);
        
        // Add winner to winners list
        this.addWinnerToList(data);
        
        // Update game state
        if (this.gameState) {
            this.gameState.winners = this.gameState.winners || [];
            this.gameState.winners.push(data);
        }
    }
    
    handleGameUpdate(data) {
        this.gameState = data.gameState;
        this.updateGameUI(data);
    }
    
    handleChatMessage(data) {
        this.addChatMessage(data.playerName, data.message, data.isSystem);
    }
    
    handlePlayerLeft(data) {
        this.showNotification(`${data.playerName} ክፍሉን ለቀቀ`, false);
    }
    
    handleRoomsList(data) {
        this.updateRoomsList(data.rooms);
    }
    
    handleError(data) {
        this.showNotification(data.message, true);
    }
    
    // UI Update Functions
    showPage(pageId) {
        document.querySelectorAll('.page-container').forEach(page => {
            page.classList.remove('active');
        });
        document.getElementById(pageId).classList.add('active');
    }
    
    updateRoomUI(data) {
        // Update room info
        document.getElementById('roomName').textContent = 
            `${data.gameState.gameType} - ${data.playerName}'s Room`;
        document.getElementById('roomCodeDisplay').textContent = data.roomCode;
        document.getElementById('playerCount').textContent = data.gameState.players.length;
        
        // Update players list
        const playersList = document.getElementById('playersList');
        playersList.innerHTML = '';
        
        data.gameState.players.forEach(player => {
            const playerItem = document.createElement('div');
            playerItem.className = 'player-item';
            
            const isHost = player.id === data.gameState.hostId;
            const isCurrentPlayer = player.id === this.playerId;
            
            playerItem.innerHTML = `
                <div class="player-avatar" style="background: ${this.getColorFromName(player.name)}">
                    ${player.name.charAt(0).toUpperCase()}
                </div>
                <div class="player-info">
                    <div class="player-name ${isCurrentPlayer ? 'amharic-text' : ''}">
                        ${player.name} ${isCurrentPlayer ? '(እርስዎ)' : ''}
                    </div>
                    <div class="player-status">
                        ${isHost ? '<span class="player-host">አስተናጋጅ</span>' : 'ተጫዋች'}
                    </div>
                </div>
            `;
            
            playersList.appendChild(playerItem);
        });
        
        // Update game controls based on player role
        const isHost = this.gameState?.hostId === this.playerId;
        const isGameActive = this.gameState?.status === 'playing';
        
        document.getElementById('startGameBtn').disabled = isGameActive || !isHost;
        document.getElementById('callNumberBtn').disabled = !isGameActive || !isHost;
        
        if (this.gameState?.calledNumbers) {
            document.getElementById('calledCount').textContent = this.gameState.calledNumbers.length;
            this.updateCalledNumbersDisplay();
        }
    }
    
    updateGameUI(data) {
        // Update game info
        document.getElementById('gameRoomName').textContent = 
            `${this.gameState.gameType} - ${this.currentRoom}`;
        document.getElementById('gameStatus').textContent = 
            this.gameState.status === 'playing' ? 'በመጫወት ላይ' : 'በመጠበቅ ላይ';
        
        // Update player board
        document.getElementById('playerBoardTitle').textContent = 
            `${this.playerName}'s Board`;
        
        // Generate game board if needed
        if (this.playerBoard && !document.querySelector('.board-cell')) {
            this.generateGameBoard();
        }
        
        // Update stats
        this.updateBoardStats();
        
        // Update win pattern
        document.getElementById('winPattern').textContent = 
            this.getWinPatternName(this.gameState.winPattern);
        
        // Update called numbers
        if (this.gameState.calledNumbers) {
            document.getElementById('calledCount').textContent = this.gameState.calledNumbers.length;
            this.updateCalledNumbersDisplay();
        }
        
        // Update winners list
        if (this.gameState.winners) {
            this.updateWinnersList();
        }
    }
    
    generateGameBoard() {
        const boardElement = document.getElementById('gameBoard');
        boardElement.innerHTML = '';
        boardElement.className = `game-board board-${this.gameState.gameType}`;
        
        if (!this.playerBoard) return;
        
        const boardData = this.playerBoard.numbers || this.playerBoard;
        
        if (this.gameState.gameType === '75ball' || this.gameState.gameType === 'pattern') {
            this.generate75BallBoard(boardData);
        } else if (this.gameState.gameType === '90ball') {
            this.generate90BallBoard(boardData);
        } else if (this.gameState.gameType === '30ball') {
            this.generate30BallBoard(boardData);
        }
    }
    
    generate75BallBoard(boardData) {
        const boardElement = document.getElementById('gameBoard');
        const letters = ['B', 'I', 'N', 'G', 'O'];
        
        // Add column headers
        for (let i = 0; i < 5; i++) {
            const header = document.createElement('div');
            header.className = 'board-cell center-cell';
            header.textContent = letters[i];
            boardElement.appendChild(header);
        }
        
        // Add numbers
        for (let row = 0; row < 5; row++) {
            for (let col = 0; col < 5; col++) {
                // Center cell is free
                if (row === 2 && col === 2) {
                    const centerCell = document.createElement('div');
                    centerCell.className = 'board-cell center-cell';
                    centerCell.textContent = '★';
                    centerCell.onclick = () => this.claimWin();
                    boardElement.appendChild(centerCell);
                    continue;
                }
                
                const number = boardData[col]?.[row];
                if (number !== undefined) {
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
        
        // 90-ball uses 9 columns, 3 rows
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
        
        // 30-ball uses 3x3 grid
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
    
    toggleMark(number, cell) {
        if (this.markedNumbers.has(number)) {
            this.markedNumbers.delete(number);
            cell.classList.remove('marked');
        } else {
            this.markedNumbers.add(number);
            cell.classList.add('marked');
        }
        
        this.updateBoardStats();
        this.checkWinCondition();
    }
    
    markNumberOnBoard(number) {
        const cells = document.querySelectorAll(`[data-number="${number}"]`);
        cells.forEach(cell => {
            if (!cell.classList.contains('marked')) {
                cell.classList.add('marked');
                this.markedNumbers.add(number);
            }
        });
        
        this.updateBoardStats();
        this.checkWinCondition();
    }
    
    updateBoardStats() {
        const totalCells = document.querySelectorAll('.board-cell:not(.blank-cell)').length;
        const markedCount = this.markedNumbers.size;
        
        document.getElementById('markedCount').textContent = markedCount;
        document.getElementById('remainingCount').textContent = totalCells - markedCount;
    }
    
    checkWinCondition() {
        if (!this.playerBoard || !this.gameState) return false;
        
        const pattern = this.gameState.winPattern;
        const isWin = this.checkPatternWin(pattern);
        
        // Update claim win button
        document.getElementById('claimWinBtn').disabled = !isWin;
        
        return isWin;
    }
    
    checkPatternWin(pattern) {
        // Simplified win checking
        // In a real implementation, this would check specific patterns
        const totalCells = document.querySelectorAll('.board-cell:not(.blank-cell)').length;
        const markedCount = this.markedNumbers.size;
        
        switch(pattern) {
            case 'full-house':
                return markedCount >= totalCells * 0.8; // 80% marked for demo
            case 'one-line':
                // Check rows
                return this.checkLineWin();
            case 'x-pattern':
                return this.checkXPattern();
            default:
                return markedCount >= totalCells * 0.7;
        }
    }
    
    checkLineWin() {
        // Check for a completed row
        const board = document.getElementById('gameBoard');
        const rows = this.gameState.gameType === '75ball' ? 5 : 
                    this.gameState.gameType === '90ball' ? 3 : 3;
        const cols = this.gameState.gameType === '75ball' ? 5 : 
                    this.gameState.gameType === '90ball' ? 9 : 3;
        
        for (let row = 0; row < rows; row++) {
            let complete = true;
            for (let col = 0; col < cols; col++) {
                const cell = board.children[row * cols + col];
                if (cell && !cell.classList.contains('marked') && !cell.classList.contains('blank-cell')) {
                    complete = false;
                    break;
                }
            }
            if (complete) return true;
        }
        return false;
    }
    
    checkXPattern() {
        // Check for X pattern (diagonals)
        const board = document.getElementById('gameBoard');
        const size = this.gameState.gameType === '75ball' ? 5 : 3;
        
        let diag1 = true;
        let diag2 = true;
        
        for (let i = 0; i < size; i++) {
            const cell1 = board.children[i * size + i];
            const cell2 = board.children[i * size + (size - 1 - i)];
            
            if (cell1 && !cell1.classList.contains('marked') && !cell1.classList.contains('blank-cell')) {
                diag1 = false;
            }
            if (cell2 && !cell2.classList.contains('marked') && !cell2.classList.contains('blank-cell')) {
                diag2 = false;
            }
        }
        
        return diag1 || diag2;
    }
    
    detectWinPattern() {
        if (this.checkLineWin()) return 'one-line';
        if (this.checkXPattern()) return 'x-pattern';
        
        const totalCells = document.querySelectorAll('.board-cell:not(.blank-cell)').length;
        if (this.markedNumbers.size >= totalCells) return 'full-house';
        
        return 'custom';
    }
    
    getWinPatternName(pattern) {
        const patterns = {
            'full-house': 'ሙሉ ቤት',
            'one-line': 'አንድ ረድፍ',
            'two-lines': 'ሁለት ረድፍ',
            'x-pattern': 'X ንድፍ',
            'four-corners': 'አራት ማእዘኖች',
            'diagonal': 'ዲያግናል',
            'pattern': 'ተጠቀም ንድፍ'
        };
        
        return patterns[pattern] || pattern;
    }
    
    updateCalledNumbersDisplay() {
        const container = document.getElementById('calledNumbers');
        container.innerHTML = '';
        
        if (!this.gameState?.calledNumbers) return;
        
        this.gameState.calledNumbers.slice(-10).forEach(number => {
            const element = document.createElement('div');
            element.className = 'called-number';
            element.textContent = number;
            container.appendChild(element);
        });
    }
    
    addCalledNumber(number) {
        const container = document.getElementById('calledNumbers');
        const element = document.createElement('div');
        element.className = 'called-number';
        element.textContent = number;
        container.appendChild(element);
        
        // Keep only last 10 numbers
        const numbers = container.children;
        if (numbers.length > 10) {
            container.removeChild(numbers[0]);
        }
    }
    
    updateRoomsList(rooms) {
        const container = document.getElementById('roomList');
        container.innerHTML = '';
        
        if (!rooms || rooms.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: rgba(255,255,255,0.5);">ምንም ንቁ ክፍሎች የሉም</p>';
            return;
        }
        
        rooms.forEach(room => {
            const element = document.createElement('div');
            element.className = 'room-item';
            element.onclick = () => {
                document.getElementById('roomCode').value = room.code;
                document.getElementById('playerName').focus();
            };
            
            element.innerHTML = `
                <div class="room-item-header">
                    <div class="room-name">${room.gameType} - ${room.hostName}</div>
                    <div class="room-players">${room.playerCount}/10</div>
                </div>
                <div class="room-info">
                    ኮድ: ${room.code}<br>
                    ሁኔታ: ${room.status === 'waiting' ? 'በመጠበቅ ላይ' : 'በመጫወት ላይ'}
                </div>
            `;
            
            container.appendChild(element);
        });
    }
    
    updateWinnersList() {
        const container = document.getElementById('winnersList');
        container.innerHTML = '';
        
        if (!this.gameState?.winners || this.gameState.winners.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: rgba(255,255,255,0.5);">እስካሁን ምንም አሸናፊ የለም</p>';
            return;
        }
        
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
        
        // Keep only last 5 winners
        const winners = container.children;
        if (winners.length > 5) {
            container.removeChild(winners[5]);
        }
    }
    
    addChatMessage(sender, message, isSystem = false) {
        const container = document.getElementById('chatMessages');
        const element = document.createElement('div');
        element.className = `chat-message ${isSystem ? 'system' : ''}`;
        
        if (isSystem) {
            element.textContent = message;
        } else {
            element.innerHTML = `<span class="sender">${sender}:</span> ${message}`;
        }
        
        container.appendChild(element);
        container.scrollTop = container.scrollHeight;
    }
    
    // Utility Functions
    getColorFromName(name) {
        const colors = [
            '#0d47a1', '#1a237e', '#311b92', '#4a148c',
            '#880e4f', '#b71c1c', '#d84315', '#f57c00',
            '#ff8f00', '#f9a825', '#afb42b', '#689f38',
            '#388e3c', '#00796b', '#00838f', '#0277bd'
        ];
        
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        
        return colors[Math.abs(hash) % colors.length];
    }
    
    loadPlayerData() {
        // Load saved player data
        const savedName = localStorage.getItem('bingo_player_name');
        if (savedName) {
            document.getElementById('playerName').value = savedName;
            document.getElementById('newPlayerName').value = savedName;
        }
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
    
    // Expose functions to global scope for onclick handlers
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
    
    // Handle chat input enter key
    document.getElementById('chatInput')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            gameClient.sendChatMessage();
        }
    });
});
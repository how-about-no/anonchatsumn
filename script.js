class LaroChat {
    constructor() {
        this.channelName = 'larochat-channel';
        this.broadcastChannel = null;
        this.userName = 'Anonymous';
        this.userId = this.generateUserId();
        this.isConnected = false;
        this.messageCount = 0;
        this.activeGame = null; // { board: Array(9), xPlayerId, oPlayerId, turnId, status }
        this.pendingInvite = null; // { fromUserId, fromUserName }
        
        this.initializeElements();
        this.initializeBroadcastChannel();
        this.bindEvents();
        this.loadUserName();
        this.updateConnectionStatus();
    }

    initializeElements() {
        this.messagesContainer = document.getElementById('messages');
        this.messageInput = document.getElementById('messageInput');
        this.sendButton = document.getElementById('sendButton');
        this.clearChatButton = document.getElementById('clearChat');
        this.statusDot = document.getElementById('statusDot');
        this.statusText = document.getElementById('statusText');
        this.userNameDisplay = document.getElementById('userName');
        this.changeNameButton = document.getElementById('changeName');
        this.nameModal = document.getElementById('nameModal');
        this.nameInput = document.getElementById('nameInput');
        this.saveNameButton = document.getElementById('saveName');
        this.cancelNameButton = document.getElementById('cancelName');
        this.charCount = document.getElementById('charCount');
        // Game elements
        this.gameArea = document.getElementById('gameArea');
        this.gameBoard = document.getElementById('gameBoard');
        this.gameStatus = document.getElementById('gameStatus');
        this.newInviteBtn = document.getElementById('newInvite');
        this.endGameBtn = document.getElementById('endGame');
        this.inviteFromHeader = document.getElementById('inviteFromHeader');
        // modal based selection
        this.gameModal = document.getElementById('gameModal');
        this.gameSelectTicTac = document.getElementById('gameSelectTicTac');
        this.gameSelectCancel = document.getElementById('gameSelectCancel');
        // popover
        this.invitePopover = document.getElementById('invitePopover');
        this.popoverTicTac = document.getElementById('popoverTicTac');
        this.inviteMenu = document.getElementById('inviteMenu');
        this.inviteTicTac = document.getElementById('inviteTicTac');
        this.inviteBar = document.getElementById('inviteBar');
        this.inviteText = document.getElementById('inviteText');
        this.inviteAccept = document.getElementById('inviteAccept');
        this.inviteDecline = document.getElementById('inviteDecline');
    }

    initializeBroadcastChannel() {
        try {
            this.broadcastChannel = new BroadcastChannel(this.channelName);
            this.broadcastChannel.onmessage = (event) => this.handleMessage(event);
            this.isConnected = true;
            this.updateConnectionStatus();
            
            // Send a connection message to announce this tab
            this.sendSystemMessage('connected');
        } catch (error) {
            console.error('Failed to initialize BroadcastChannel:', error);
            this.isConnected = false;
            this.updateConnectionStatus();
        }
    }

    bindEvents() {
        // Send message events
        if (this.sendButton) {
            this.sendButton.addEventListener('click', () => this.sendMessage());
        }
        if (this.messageInput) {
            this.messageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });
        }

        // Character count
        if (this.charCount) {
            this.messageInput.addEventListener('input', () => this.updateCharCount());
        }

        // Clear chat
        if (this.clearChatButton) {
            this.clearChatButton.addEventListener('click', () => this.clearChat());
        }

        // Name change modal
        if (this.changeNameButton) {
            this.changeNameButton.addEventListener('click', () => this.openNameModal());
        }
        if (this.saveNameButton) {
            this.saveNameButton.addEventListener('click', () => this.saveName());
        }
        if (this.cancelNameButton) {
            this.cancelNameButton.addEventListener('click', () => this.closeNameModal());
        }
        if (this.nameInput) {
            this.nameInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.saveName();
                }
            });
        }

        // Close modal when clicking outside
        if (this.nameModal) {
            this.nameModal.addEventListener('click', (e) => {
                if (e.target === this.nameModal) {
                    this.closeNameModal();
                }
            });
        }

        // Handle page visibility changes
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.sendSystemMessage('disconnected');
            } else {
                this.sendSystemMessage('connected');
            }
        });

        // Handle beforeunload
        window.addEventListener('beforeunload', () => {
            this.sendSystemMessage('disconnected');
        });

        // Game UI
        if (this.gameBoard) {
            this.gameBoard.addEventListener('click', (e) => this.handleCellClick(e));
        }
        if (this.newInviteBtn) {
            this.newInviteBtn.addEventListener('click', () => this.sendGameInvite());
        }
        if (this.inviteFromHeader) {
            this.inviteFromHeader.addEventListener('click', (e) => { e.stopPropagation(); this.toggleInvitePopover(e); });
        }
        if (this.popoverTicTac) {
            this.popoverTicTac.addEventListener('click', () => { this.hideInvitePopover(); this.sendGameInvite('tic-tac-toe'); });
        }
        if (this.inviteTicTac) {
            this.inviteTicTac.addEventListener('click', () => { this.hideInvitePopover(); this.sendGameInvite('tic-tac-toe'); });
        }
        if (this.endGameBtn) {
            this.endGameBtn.addEventListener('click', () => this.endGame('ended'));
        }
        if (this.inviteAccept) {
            this.inviteAccept.addEventListener('click', () => this.respondToInvite(true));
        }
        if (this.inviteDecline) {
            this.inviteDecline.addEventListener('click', () => this.respondToInvite(false));
        }
    }

    generateUserId() {
        return 'user_' + Math.random().toString(36).substr(2, 9);
    }

    handleMessage(event) {
        const { type, data, userId, userName, timestamp } = event.data;

        // Don't process messages from the same user/tab
        if (userId === this.userId) {
            return;
        }

        switch (type) {
            case 'message':
                this.displayMessage(data, userName, timestamp, false);
                break;
            case 'system':
                this.handleSystemMessage(data, userName);
                break;
            case 'user_connected':
                this.showNotification(`${userName} joined the chat`);
                break;
            case 'user_disconnected':
                this.showNotification(`${userName} left the chat`);
                break;
            case 'name_change':
                this.showNotification(`${data.oldName} is now ${data.newName}`);
                break;
            case 'game_invite':
                this.onGameInvite({ fromUserId: userId, fromUserName: userName, inviteId: data.inviteId, gameType: data.gameType });
                break;
            case 'game_invite_response':
                this.onGameInviteResponse(data);
                break;
            case 'game_start':
                this.onGameStart(data);
                break;
            case 'game_move':
                this.onGameMove(data);
                break;
            case 'game_end':
                this.onGameEnd(data);
                break;
        }
    }

    handleSystemMessage(action, userName) {
        switch (action) {
            case 'connected':
                this.showNotification(`${userName} joined the chat`);
                break;
            case 'disconnected':
                this.showNotification(`${userName} left the chat`);
                break;
        }
    }

    sendMessage() {
        const message = this.messageInput.value.trim();
        if (!message || !this.isConnected) return;

        const timestamp = new Date().toISOString();
        
        // Display message locally
        this.displayMessage(message, this.userName, timestamp, true);
        
        // Send message via BroadcastChannel
        this.broadcastChannel.postMessage({
            type: 'message',
            data: message,
            userId: this.userId,
            userName: this.userName,
            timestamp: timestamp
        });

        // Clear input
        this.messageInput.value = '';
        this.updateCharCount();
    }

    sendSystemMessage(action) {
        if (!this.isConnected) return;

        this.broadcastChannel.postMessage({
            type: 'system',
            data: action,
            userId: this.userId,
            userName: this.userName,
            timestamp: new Date().toISOString()
        });
    }

    displayMessage(message, userName, timestamp, isOwn) {
        // Remove welcome message if it exists
        const welcomeMessage = this.messagesContainer.querySelector('.welcome-message');
        if (welcomeMessage) {
            welcomeMessage.remove();
        }

        const messageElement = document.createElement('div');
        messageElement.className = `message ${isOwn ? 'own' : 'other'}`;
        
        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        messageContent.textContent = message;
        
        const messageInfo = document.createElement('div');
        messageInfo.className = 'message-info';
        messageInfo.innerHTML = `
            <span class="sender">${userName}</span>
            <span class="time">${this.formatTime(timestamp)}</span>
        `;
        
        messageElement.appendChild(messageContent);
        messageElement.appendChild(messageInfo);
        
        this.messagesContainer.appendChild(messageElement);
        this.scrollToBottom(true);
        
        this.messageCount++;
    }

    showNotification(message) {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #333;
            color: white;
            padding: 0.75rem 1rem;
            border-radius: 6px;
            font-size: 0.9rem;
            z-index: 1001;
            opacity: 0;
            transform: translateX(100%);
            transition: all 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        
        // Animate in
        setTimeout(() => {
            notification.style.opacity = '1';
            notification.style.transform = 'translateX(0)';
        }, 100);
        
        // Remove after 3 seconds
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    formatTime(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    scrollToBottom(force) {
        const container = document.querySelector('.chat-container');
        if (!container) return;
        // Auto-scroll if near bottom or force
        const nearBottom = (container.scrollHeight - container.scrollTop - container.clientHeight) < 120;
        if (force || nearBottom) {
            container.scrollTop = container.scrollHeight;
        }
    }

    updateCharCount() {
        if (!this.charCount) return;
        const count = this.messageInput.value.length;
        this.charCount.textContent = `${count}/500`;
        if (count > 450) this.charCount.style.color = '#dc3545';
        else if (count > 400) this.charCount.style.color = '#ffc107';
        else this.charCount.style.color = '#666';
    }

    clearChat() {
        if (confirm('Are you sure you want to clear all messages?')) {
            this.messagesContainer.innerHTML = `
                <div class="welcome-message">
                    <h2>Chat Cleared!</h2>
                    <p>Start a new conversation by opening another tab.</p>
                </div>
            `;
            this.messageCount = 0;
        }
    }

    openNameModal() {
        this.nameInput.value = this.userName;
        this.nameModal.style.display = 'block';
        this.nameInput.focus();
        this.nameInput.select();
    }

    closeNameModal() {
        this.nameModal.style.display = 'none';
    }

    saveName() {
        const newName = this.nameInput.value.trim();
        if (newName && newName !== this.userName) {
            const oldName = this.userName;
            this.userName = newName;
            this.userNameDisplay.textContent = this.userName;
            this.saveUserName();
            
            // Notify other tabs about name change
            this.broadcastChannel.postMessage({
                type: 'name_change',
                data: { oldName, newName },
                userId: this.userId,
                userName: this.userName,
                timestamp: new Date().toISOString()
            });
        }
        this.closeNameModal();
    }

    loadUserName() {
        const savedName = localStorage.getItem('larochat-username');
        if (savedName) {
            this.userName = savedName;
            this.userNameDisplay.textContent = this.userName;
        }
    }

    saveUserName() {
        localStorage.setItem('larochat-username', this.userName);
    }

    updateConnectionStatus() {
        if (this.isConnected) {
            this.statusDot.className = 'status-dot connected';
            this.statusText.textContent = 'Connected';
        } else {
            this.statusDot.className = 'status-dot disconnected';
            this.statusText.textContent = 'Disconnected';
        }
    }
}

// Initialize the chat when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new LaroChat();
});

// Handle BroadcastChannel errors
window.addEventListener('error', (event) => {
    if (event.message && event.message.includes('BroadcastChannel')) {
        console.error('BroadcastChannel not supported in this browser');
        // You could show a fallback message to the user here
    }
});

// ----- Tic-Tac-Toe and Game Invite Logic -----
LaroChat.prototype.sendGameInvite = function(gameType = 'tic-tac-toe') {
    if (this.activeGame) {
        this.showNotification('Game in progress');
        return;
    }
    const inviteId = 'invite_' + Math.random().toString(36).slice(2,9);
    this.pendingInvite = { inviteId, gameType, fromUserId: this.userId, fromUserName: this.userName };
    this.addSystemMessage(`Waiting for opponent to accept ${gameType}...`, inviteId);
    if (this.isConnected && this.broadcastChannel) {
        this.broadcastChannel.postMessage({
            type: 'game_invite',
            data: { inviteId, gameType },
            userId: this.userId,
            userName: this.userName,
            timestamp: new Date().toISOString()
        });
    } else {
        this.showNotification('Not connected: your invite is only shown locally');
    }
};

LaroChat.prototype.onGameInvite = function({ fromUserId, fromUserName, inviteId, gameType = 'tic-tac-toe' }) {
    if (this.activeGame || this.pendingInvite) {
        // Auto-decline if we're busy
        this.broadcastChannel.postMessage({
            type: 'game_invite_response',
            data: { accepted: false, toUserId: fromUserId, reason: 'busy', inviteId },
            userId: this.userId,
            userName: this.userName,
            timestamp: new Date().toISOString()
        });
        return;
    }
    this.pendingInvite = { fromUserId, fromUserName, inviteId, gameType };
    this.addSystemInvite(`${fromUserName} invited you to play ${gameType}`, inviteId);
};

LaroChat.prototype.respondToInvite = function(accepted, inviteId) {
    if (!this.pendingInvite) return;
    const { fromUserId, fromUserName } = this.pendingInvite;
    this.broadcastChannel.postMessage({
        type: 'game_invite_response',
        data: { accepted, toUserId: fromUserId, inviteId },
        userId: this.userId,
        userName: this.userName,
        timestamp: new Date().toISOString()
    });
    if (accepted) {
        // Start the game: inviter is X, invitee is O
        const xPlayerId = fromUserId; // inviter
        const oPlayerId = this.userId; // accepter
        const startPayload = {
            xPlayerId,
            oPlayerId,
            turnId: xPlayerId,
            board: Array(9).fill(''),
            inviteId
        };
        this.broadcastChannel.postMessage({
            type: 'game_start',
            data: startPayload,
            userId: this.userId,
            userName: this.userName,
            timestamp: new Date().toISOString()
        });
        // Apply locally too
        this.onGameStart(startPayload);
    } else {
        this.pendingInvite = null;
    }
};

LaroChat.prototype.onGameInviteResponse = function(data) {
    // Only inviter cares about responses intended for them
    if (!this.pendingInvite || this.pendingInvite.fromUserId !== this.userId) return;
    if (data.toUserId !== this.userId) return;
    if (data.inviteId !== this.pendingInvite.inviteId) return;
    if (!data.accepted) {
        this.updateSystemMessage(this.pendingInvite.inviteId, 'Invite declined');
        this.pendingInvite = null;
    }
};

LaroChat.prototype.onGameStart = function(data) {
    const { xPlayerId, oPlayerId, turnId, board, inviteId } = data;
    // Only players should initialize
    if (this.userId !== xPlayerId && this.userId !== oPlayerId) return;
    this.activeGame = { xPlayerId, oPlayerId, turnId, board: board.slice(), status: 'playing' };
    if (this.pendingInvite && this.pendingInvite.inviteId === inviteId) {
        this.updateSystemMessage(inviteId, 'Game starting...');
        this.pendingInvite = null;
    }
    this.gameArea.style.display = 'block';
    this.updateGameUI();
    // Scroll to game area to avoid having to manually scroll
    try {
        this.gameArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (_) {}
};

LaroChat.prototype.currentSymbol = function() {
    if (!this.activeGame) return '';
    return this.userId === this.activeGame.xPlayerId ? 'X' : 'O';
};

LaroChat.prototype.isMyTurn = function() {
    return this.activeGame && this.activeGame.turnId === this.userId;
};

LaroChat.prototype.handleCellClick = function(e) {
    const cell = e.target.closest('.cell');
    if (!cell || !this.activeGame || this.activeGame.status !== 'playing') return;
    const index = parseInt(cell.getAttribute('data-index'), 10);
    if (!this.isMyTurn() || this.activeGame.board[index]) return;
    const symbol = this.currentSymbol();
    const newBoard = this.activeGame.board.slice();
    newBoard[index] = symbol;
    const nextTurnId = this.userId === this.activeGame.xPlayerId ? this.activeGame.oPlayerId : this.activeGame.xPlayerId;
    const payload = { index, symbol, board: newBoard, nextTurnId };
    // Apply locally
    this.onGameMove(payload);
    // Broadcast
    this.broadcastChannel.postMessage({
        type: 'game_move',
        data: payload,
        userId: this.userId,
        userName: this.userName,
        timestamp: new Date().toISOString()
    });
};

LaroChat.prototype.onGameMove = function(data) {
    if (!this.activeGame) return;
    const { index, symbol, board, nextTurnId } = data;
    // Validate move
    if (this.activeGame.board[index]) return;
    this.activeGame.board = board.slice();
    this.activeGame.turnId = nextTurnId;
    // Check winner
    const winner = this.checkWinner(this.activeGame.board);
    if (winner || this.activeGame.board.every(c => c)) {
        const outcome = winner ? (winner === 'X' ? this.activeGame.xPlayerId : this.activeGame.oPlayerId) : 'draw';
        this.endGame('finished', outcome);
        this.broadcastChannel.postMessage({
            type: 'game_end',
            data: { outcome },
            userId: this.userId,
            userName: this.userName,
            timestamp: new Date().toISOString()
        });
        return;
    }
    this.updateGameUI();
};

LaroChat.prototype.onGameEnd = function(data) {
    if (!this.activeGame) return;
    this.endGame('finished', data.outcome);
};

LaroChat.prototype.endGame = function(reason, outcome) {
    if (!this.activeGame && reason !== 'ended') return;
    // Prevent duplicate processing/announcements
    if (this.activeGame && this.activeGame.status === 'finished' && reason === 'finished') return;
    let statusText = 'Game ended';
    if (reason === 'finished') {
        if (outcome === 'draw') statusText = 'Draw!';
        else statusText = outcome === this.userId ? 'You won!' : 'You lost';
    }
    this.gameStatus.textContent = statusText;
    if (this.activeGame) {
        this.activeGame.status = 'finished';
    }
    Array.from(this.gameBoard.querySelectorAll('.cell')).forEach(btn => btn.disabled = true);
    // Announce winner/finish in messages
    const winnerName = outcome === 'draw' ? 'No one' : (outcome === this.userId ? 'You' : 'Opponent');
    const summary = outcome === 'draw' ? 'The game ended in a draw.' : `${winnerName} won the game.`;
    this.addSystemMessage(summary);
    setTimeout(() => {
        this.resetGameUI();
    }, 1500);
};

LaroChat.prototype.resetGameUI = function() {
    if (this.gameBoard) {
        Array.from(this.gameBoard.querySelectorAll('.cell')).forEach(btn => {
            btn.textContent = '';
            btn.disabled = false;
        });
    }
    this.gameArea.style.display = 'none';
    this.gameStatus.textContent = 'Invite someone to play';
    this.activeGame = null;
};

LaroChat.prototype.updateGameUI = function() {
    if (!this.activeGame) return;
    const cells = Array.from(this.gameBoard.querySelectorAll('.cell'));
    this.activeGame.board.forEach((val, i) => {
        cells[i].textContent = val || '';
    });
    const turnText = this.isMyTurn() ? 'Your turn' : "Opponent's turn";
    this.gameStatus.textContent = `${turnText} (${this.currentSymbol()})`;
};

LaroChat.prototype.checkWinner = function(board) {
    const lines = [
        [0,1,2],[3,4,5],[6,7,8],
        [0,3,6],[1,4,7],[2,5,8],
        [0,4,8],[2,4,6]
    ];
    for (const [a,b,c] of lines) {
        if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
    }
    return '';
};

LaroChat.prototype.showInviteBar = function(text, showActions) {
    if (!this.inviteBar) return;
    this.inviteText.textContent = text;
    this.inviteBar.style.display = 'flex';
    this.inviteBar.style.justifyContent = 'space-between';
    this.inviteBar.querySelector('.game-actions').style.display = showActions ? 'flex' : 'none';
};

LaroChat.prototype.hideInviteBar = function() {
    if (!this.inviteBar) return;
    this.inviteBar.style.display = 'none';
};

// System message helpers for invites
LaroChat.prototype.addSystemMessage = function(text, id) {
    const wrap = document.createElement('div');
    wrap.className = 'system-message';
    if (id) wrap.dataset.msgId = id;
    wrap.textContent = text;
    this.messagesContainer.appendChild(wrap);
    this.scrollToBottom(true);
};

LaroChat.prototype.addSystemInvite = function(text, inviteId) {
    const wrap = document.createElement('div');
    wrap.className = 'system-message';
    wrap.dataset.msgId = inviteId;
    wrap.innerHTML = `
        <div>${text}</div>
        <div class="actions">
            <button class="btn-inline" data-accept="${inviteId}">Accept</button>
            <button class="btn-inline danger" data-decline="${inviteId}">Decline</button>
        </div>
    `;
    this.messagesContainer.appendChild(wrap);
    this.scrollToBottom(true);
    wrap.addEventListener('click', (e) => {
        const accept = e.target.closest('[data-accept]');
        const decline = e.target.closest('[data-decline]');
        if (accept) this.respondToInvite(true, inviteId);
        if (decline) this.respondToInvite(false, inviteId);
    });
};

LaroChat.prototype.updateSystemMessage = function(id, newText) {
    const el = this.messagesContainer.querySelector(`.system-message[data-msg-id="${id}"]`);
    if (el) {
        el.textContent = newText;
    }
};

// Invite menu helpers
LaroChat.prototype.openGameModal = function() {
    if (this.gameModal) this.gameModal.style.display = 'block';
};
LaroChat.prototype.closeGameModal = function() {
    if (this.gameModal) this.gameModal.style.display = 'none';
};

// Anchored popover near invite button
LaroChat.prototype.toggleInvitePopover = function(e) {
    if (!this.inviteMenu || !this.inviteFromHeader) return;
    const isShown = this.inviteMenu.style.display === 'flex';
    if (isShown) {
        this.inviteMenu.style.display = 'none';
        return;
    }
    this.inviteMenu.style.display = 'flex';
    const onDoc = (evt) => {
        if (!this.inviteMenu.contains(evt.target) && !this.inviteFromHeader.contains(evt.target)) {
            this.inviteMenu.style.display = 'none';
            document.removeEventListener('click', onDoc);
        }
    };
    setTimeout(() => document.addEventListener('click', onDoc), 0);
};

LaroChat.prototype.hideInvitePopover = function() {
    if (this.inviteMenu) this.inviteMenu.style.display = 'none';
};

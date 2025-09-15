// ----- Tic-Tac-Toe and Game Invite Logic (split from script.js) -----

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
        data: { accepted, toUserId: fromUserId, inviteId, reason: accepted ? 'accepted' : 'declined' },
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
    // Ignore auto-declines from other tabs that are 'busy'
    if (!data.accepted) {
        if (data.reason !== 'declined') return;
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
        this.updateSystemMessage(inviteId, 'Game Started');
        this.pendingInvite = null;
    }
    this.slideOpenGameArea();
    this.updateGameUI();
    // Scroll to game area to avoid having to manually scroll
    try {
        this.gameArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
        // Ensure desktop scroll container also jumps to show the game
        const scrollable = document.querySelector('.scrollable-content');
        if (scrollable) {
            // Delay to allow open transition to allocate height
            setTimeout(() => {
                scrollable.scrollTop = scrollable.scrollHeight;
            }, 120);
        }
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
    // Update UI immediately so the last move is visible
    this.updateGameUI();
    // Check winner after rendering the last move
    const winner = this.checkWinner(this.activeGame.board);
    const winningLine = this.findWinningLine(this.activeGame.board);
    if (winner || this.activeGame.board.every(c => c)) {
        const outcome = winner ? (winner === 'X' ? this.activeGame.xPlayerId : this.activeGame.oPlayerId) : 'draw';
        this.lastWinningLine = winner ? winningLine : null;
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
};

LaroChat.prototype.onGameEnd = function(data) {
    if (!this.activeGame) return;
    this.endGame('finished', data.outcome);
};

LaroChat.prototype.endGame = function(reason, outcome) {
    if (!this.activeGame && reason !== 'ended') return;
    // Prevent duplicate processing/announcements
    if (this.activeGame && this.activeGame.status === 'finished' && reason === 'finished') return;
    
    // If manually ended, broadcast to other player
    if (reason === 'ended' && this.activeGame && this.isConnected && this.broadcastChannel) {
        this.broadcastChannel.postMessage({
            type: 'game_end',
            data: { outcome: 'opponent_quit' },
            userId: this.userId,
            userName: this.userName,
            timestamp: new Date().toISOString()
        });
    }
    
    let statusText = 'Game ended';
    if (reason === 'finished') {
        if (outcome === 'draw') statusText = 'Draw!';
        else if (outcome === 'opponent_quit') statusText = '(Opponent quit)';
        else statusText = outcome === this.userId ? 'You won!' : 'You lost';
    } else if (reason === 'ended') {
        statusText = 'Game ended';
    }
    
    this.gameStatus.textContent = statusText;
    if (this.activeGame) {
        this.activeGame.status = 'finished';
    }
    Array.from(this.gameBoard.querySelectorAll('.cell')).forEach(btn => btn.disabled = true);
    // Highlight winning cells if any
    if (reason === 'finished' && outcome !== 'draw' && outcome !== 'opponent_quit' && Array.isArray(this.lastWinningLine)) {
        const cells = Array.from(this.gameBoard.querySelectorAll('.cell'));
        this.lastWinningLine.forEach(i => {
            const cell = cells[i];
            if (cell) cell.classList.add('win');
        });
    }
    // Announce winner/finish in messages
    let summary;
    if (reason === 'ended') {
        summary = 'Game ended by player.';
    } else if (outcome === 'opponent_quit') {
        summary = 'You won! Your opponent quit the game.';
    } else if (outcome === 'draw') {
        summary = 'The game ended in a draw.';
    } else {
        const winnerName = outcome === this.userId ? 'You' : 'Opponent';
        summary = `${winnerName} won the game.`;
    }
    this.addSystemMessage(summary);
    // After a brief delay to show highlight, slide-close area then reset
    const highlightDelayMs = (outcome === 'draw' || reason === 'ended') ? 600 : 900;
    setTimeout(() => {
        this.slideCloseGameArea(() => {
            this.resetGameUI();
        });
    }, highlightDelayMs);
};

LaroChat.prototype.resetGameUI = function() {
    if (this.gameBoard) {
        Array.from(this.gameBoard.querySelectorAll('.cell')).forEach(btn => {
            btn.textContent = '';
            btn.disabled = false;
            btn.classList.remove('win');
        });
    }
    this.gameArea.style.display = 'none';
    this.gameArea.classList.remove('open');
    this.gameArea.classList.remove('closing');
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

// Return winning line indices if any, else null
LaroChat.prototype.findWinningLine = function(board) {
    const lines = [
        [0,1,2],[3,4,5],[6,7,8],
        [0,3,6],[1,4,7],[2,5,8],
        [0,4,8],[2,4,6]
    ];
    for (const [a,b,c] of lines) {
        if (board[a] && board[a] === board[b] && board[a] === board[c]) return [a,b,c];
    }
    return null;
};

// Animate opening the game area
LaroChat.prototype.slideOpenGameArea = function() {
    if (!this.gameArea) return;
    this.gameArea.style.display = 'block';
    // next frame to allow transition
    requestAnimationFrame(() => {
        this.gameArea.classList.add('open');
        this.gameArea.classList.remove('closing');
    });
};

// Animate closing the game area. Calls onDone after transition.
LaroChat.prototype.slideCloseGameArea = function(onDone) {
    if (!this.gameArea) { if (onDone) onDone(); return; }
    const handler = () => {
        this.gameArea.removeEventListener('transitionend', handler);
        if (typeof onDone === 'function') onDone();
    };
    // Fallback in case transitionend doesn't fire
    setTimeout(handler, 450);
    this.gameArea.classList.remove('open');
    this.gameArea.classList.add('closing');
};

// System message helpers for invites (kept with game for cohesion)
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



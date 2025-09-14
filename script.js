class LaroChat {
    constructor() {
        this.channelName = 'larochat-channel';
        this.broadcastChannel = null;
        this.userName = 'Anonymous';
        this.userId = this.generateUserId();
        this.isConnected = false;
        this.messageCount = 0;
        
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
        this.sendButton.addEventListener('click', () => this.sendMessage());
        this.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Character count
        this.messageInput.addEventListener('input', () => this.updateCharCount());

        // Clear chat
        this.clearChatButton.addEventListener('click', () => this.clearChat());

        // Name change modal
        this.changeNameButton.addEventListener('click', () => this.openNameModal());
        this.saveNameButton.addEventListener('click', () => this.saveName());
        this.cancelNameButton.addEventListener('click', () => this.closeNameModal());
        this.nameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.saveName();
            }
        });

        // Close modal when clicking outside
        this.nameModal.addEventListener('click', (e) => {
            if (e.target === this.nameModal) {
                this.closeNameModal();
            }
        });

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
        this.scrollToBottom();
        
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

    scrollToBottom() {
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }

    updateCharCount() {
        const count = this.messageInput.value.length;
        this.charCount.textContent = `${count}/500`;
        
        if (count > 450) {
            this.charCount.style.color = '#dc3545';
        } else if (count > 400) {
            this.charCount.style.color = '#ffc107';
        } else {
            this.charCount.style.color = '#666';
        }
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

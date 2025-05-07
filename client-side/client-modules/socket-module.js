import { getAuthToken } from './auth-module.js';
import { showToast } from '../client-utils/ui-utils.js';
import { getTokenFromStorage } from '../client-utils/storage-utils.js';

// Modern, robust Socket.IO module initializer
export function initSocketModule(options = {}) {
  const socketOptions = {
    path: '/interac/socket.io',
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
    ...options
  };

  // Initialize socket
  const socket = io(socketOptions);
  
  // Set up event handlers
  socket.on('connect', () => {
    console.log('Socket connected', socket.id);
    
    // Start heartbeat after successful connection
    startHeartbeat(socket);
    
    // Emit presence when connected
    socket.emit('user:presence', { status: 'online' });
  });
  
  socket.on('disconnect', (reason) => {
    console.log('Socket disconnected:', reason);
    
    // Stop heartbeat on disconnect
    stopHeartbeat();
  });
  
  socket.on('connect_error', (error) => {
    console.error('Socket connection error:', error);
  });

  // Handle user list updates with improved display
  socket.on('user_list', (users) => {
    console.log('Updated user list received:', users);
    
    // Store in global state if state manager exists
    if (typeof window.setState === 'function') {
      window.setState('onlineUsers', users);
    }
    
    // Update user list UI
    updateUserDisplay(users);
  });
  
  // Handle user disconnect notifications
  socket.on('user_disconnected', (data) => {
    if (data.username) {
      // Add system message about user disconnection
      const chatMessages = document.getElementById('chat-messages');
      if (chatMessages) {
        const disconnectMsg = document.createElement('div');
        disconnectMsg.className = 'chat-message-disconnected';
        disconnectMsg.innerHTML = `<span>${data.username} has disconnected</span>`;
        chatMessages.appendChild(disconnectMsg);
        chatMessages.scrollTop = chatMessages.scrollHeight;
      }
    }
  });
  
  // Handle user reconnection notifications
  socket.on('user_reconnected', (data) => {
    if (data.username) {
      // Add system message about user reconnection
      const chatMessages = document.getElementById('chat-messages');
      if (chatMessages) {
        const reconnectMsg = document.createElement('div');
        reconnectMsg.className = 'chat-message-system';
        reconnectMsg.innerHTML = `<span>${data.username} has reconnected</span>`;
        chatMessages.appendChild(reconnectMsg);
        chatMessages.scrollTop = chatMessages.scrollHeight;
      }
    }
  });
  
  return socket;
}

// Heartbeat interval reference
let heartbeatInterval = null;

/**
 * Start sending heartbeats to the server to maintain presence
 * @param {Object} socket - The socket.io client
 */
function startHeartbeat(socket) {
  // Clear any existing interval
  stopHeartbeat();
  
  // Send heartbeat every 15 seconds
  heartbeatInterval = setInterval(() => {
    if (socket && socket.connected) {
      socket.emit('user:heartbeat');
    }
  }, 15000);
  
  // Send initial heartbeat
  socket.emit('user:heartbeat');
}

/**
 * Stop the heartbeat interval
 */
function stopHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

/**
 * Update user display in UI elements
 * @param {Array} users - Array of online users
 */
function updateUserDisplay(users) {
  // Get current username
  const currentUsername = localStorage.getItem('username');
  
  // Update user lists in UI
  const userElements = document.querySelectorAll('.user-list');
  
  userElements.forEach(el => {
    if (!el) return;
    
    el.innerHTML = '';
    
    if (!Array.isArray(users) || users.length === 0) {
      const emptyMessage = document.createElement('div');
      emptyMessage.className = 'empty-state';
      emptyMessage.innerHTML = '<i class="fas fa-user-slash"></i><p>No users online</p>';
      el.appendChild(emptyMessage);
      return;
    }
    
    // Sort users: current user first, then online users, then offline users
    const sortedUsers = [...users].sort((a, b) => {
      // Current user always first
      if (a.username === currentUsername) return -1;
      if (b.username === currentUsername) return 1;
      
      // Then sort by status (online first)
      if (a.status === 'online' && b.status !== 'online') return -1;
      if (a.status !== 'online' && b.status === 'online') return 1;
      
      // Then alphabetically
      return a.username.localeCompare(b.username);
    });
    
    sortedUsers.forEach(user => {
      const li = document.createElement('li');
      li.className = 'user-item';
      
      // Add status-based class
      if (user.status === 'offline' || user.status === 'inactive') {
        li.classList.add('user-offline');
      }
      
      if (user.username === currentUsername) {
        li.classList.add('current-user');
      }
      
      // Create status indicator
      const statusDot = document.createElement('span');
      statusDot.className = 'user-status';
      
      const avatar = document.createElement('div');
      avatar.className = 'user-avatar';
      avatar.textContent = (user.username.charAt(0) || '?').toUpperCase();
      
      const nameEl = document.createElement('div');
      nameEl.className = 'user-name';
      
      // Show connection count for duplicate connections
      let displayName = user.username;
      if (user.connections > 1) {
        displayName += ` (${user.connections})`;
      }
      
      // Add "you" indicator for current user
      if (user.username === currentUsername) {
        displayName += ' (you)';
      }
      
      nameEl.textContent = displayName;
      
      li.appendChild(statusDot);
      li.appendChild(avatar);
      li.appendChild(nameEl);
      el.appendChild(li);
    });
  });
}
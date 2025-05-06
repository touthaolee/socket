// client-side/admin/service/admin-chat-service.js

/**
 * Admin Chat Service Module
 * Handles chat functionality for the admin interface
 * Simplified version that connects to the main websocket chat
 */
export class AdminChatService {
  constructor() {
    this.socket = null;
    this.username = 'Admin';
    this.userId = '';
    this.users = [];
    this.messages = [];
    this.onlineUsers = 0;
    this.eventHandlers = {};
    this.isConnected = false;
  }

  /**
   * Initialize the chat service
   * @param {string} username - The username of the current admin
   * @param {string} userId - The user ID of the current admin
   */
  init(username, userId) {
    this.username = username || 'Admin';
    this.userId = userId || 'admin_' + Date.now();
    
    // Connect to socket server
    this.connectSocket();
    
    console.log('Admin Chat Service initialized for user:', this.username);
    
    // Add welcome message
    this.addSystemMessage(`Welcome to the chat, ${this.username}!`);
    
    return this;
  }
  
  /**
   * Connect to the socket server
   */
  connectSocket() {
    // Use the existing socket connection from socket-client.js
    try {
      import('/client-side/client-socket/socket-client.js')
        .then(module => {
          const socketClient = module.default;
          this.socket = socketClient.getSocket();
          
          if (!this.socket) {
            console.error('Failed to get socket instance');
            return;
          }
          
          // Connect with admin username
          socketClient.connectWithUsername(this.username);
          this.isConnected = true;
          
          console.log('Connected to socket server for admin chat');
          
          // Register socket events
          this.registerSocketEvents();
        })
        .catch(err => {
          console.error('Error importing socket client:', err);
        });
    } catch (error) {
      console.error('Error connecting to socket server:', error);
    }
  }
  
  /**
   * Register socket events for chat
   */
  registerSocketEvents() {
    if (!this.socket) return;
    
    // When receiving the user list
    this.socket.on('users_online', (users) => {
      this.users = users;
      this.onlineUsers = users.length;
      this.triggerEvent('usersUpdated', { users: this.users, onlineUsers: this.onlineUsers });
    });
    
    // When receiving a new message
    this.socket.on('chat_message', data => {
      const { message, username, userId } = data;
      
      this.messages.push({
        id: Date.now().toString(),
        text: message,
        username,
        userId,
        timestamp: new Date().toISOString(),
        isSystem: false
      });
      
      // Trigger event for UI update
      this.triggerEvent('messageReceived', { messages: this.messages });
    });
    
    // Handle connection/reconnection
    this.socket.on('connect', () => {
      this.isConnected = true;
      this.addSystemMessage('Connected to chat server');
      this.triggerEvent('connectionUpdated', { connected: true });
    });
    
    // Handle disconnection
    this.socket.on('disconnect', () => {
      this.isConnected = false;
      this.addSystemMessage('Disconnected from chat server');
      this.triggerEvent('connectionUpdated', { connected: false });
    });
  }
  
  /**
   * Send a message to the chat
   * @param {string} text - Message text
   */
  sendMessage(text) {
    if (!text.trim() || !this.socket) return;
    
    // Send message via socket
    this.socket.emit('chat_message', {
      message: text,
      username: this.username
    });
    
    // Optimistically add to local messages
    this.messages.push({
      id: Date.now().toString(),
      text,
      username: this.username,
      userId: this.userId,
      timestamp: new Date().toISOString(),
      isSystem: false,
      isSelf: true
    });
    
    // Trigger event for UI update
    this.triggerEvent('messageReceived', { messages: this.messages });
    
    return true;
  }
  
  /**
   * Add a system message to the chat
   * @param {string} text - System message text
   */
  addSystemMessage(text) {
    this.messages.push({
      id: Date.now().toString(),
      text,
      timestamp: new Date().toISOString(),
      isSystem: true
    });
    
    // Trigger event for UI update
    this.triggerEvent('messageReceived', { messages: this.messages });
  }
  
  /**
   * Get all messages
   * @returns {Array} - Array of messages
   */
  getMessages() {
    return this.messages;
  }
  
  /**
   * Get all online users
   * @returns {Array} - Array of users
   */
  getUsers() {
    return this.users;
  }
  
  /**
   * Get number of online users
   * @returns {number} - Number of online users
   */
  getOnlineUserCount() {
    return this.onlineUsers;
  }
  
  /**
   * Register event handler
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   */
  on(event, callback) {
    if (!this.eventHandlers[event]) {
      this.eventHandlers[event] = [];
    }
    
    this.eventHandlers[event].push(callback);
  }
  
  /**
   * Trigger an event
   * @param {string} event - Event name
   * @param {Object} data - Event data
   */
  triggerEvent(event, data) {
    if (!this.eventHandlers[event]) return;
    
    this.eventHandlers[event].forEach(callback => {
      callback(data);
    });
  }
  
  /**
   * Clean up resources when chat is closed
   */
  cleanup() {
    if (this.socket) {
      this.socket.off('users_online');
      this.socket.off('chat_message');
    }
    
    this.eventHandlers = {};
  }
}

// Export a singleton instance
const adminChatService = new AdminChatService();
export default adminChatService;
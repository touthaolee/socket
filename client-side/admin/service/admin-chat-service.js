// client-side/admin/service/admin-chat-service.js

/**
 * Admin Chat Service Module
 * Handles chat functionality for the admin interface
 * Connects to the main websocket chat system
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
    this.rooms = ['admin-chat', 'global']; // Join both admin-chat and global rooms
    this.selectedUser = null; // Track currently selected user for direct messaging
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
      import('/interac/client-side/client-socket/socket-client.js')
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

          // Join admin room and global room for communication with all clients
          this.rooms.forEach(room => {
            this.socket.emit('join_room', room);
            console.log(`Joining room: ${room}`);
          });
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

    // Also listen for user_list event from websocket-test.html
    this.socket.on('user_list', (users) => {
      this.users = users;
      this.onlineUsers = users.length;
      this.triggerEvent('usersUpdated', { users: this.users, onlineUsers: this.onlineUsers });
    });
    
    // When receiving a new message from index.html
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

    // Handle room messages for communication with websocket-test.html
    this.socket.on('room_message', data => {
      const { message, user, room } = data;
      
      // Accept messages from both admin-chat and global rooms
      if (this.rooms.includes(room)) {
        this.messages.push({
          id: Date.now().toString(),
          text: message,
          username: user,
          userId: 'client_' + user,
          timestamp: new Date().toISOString(),
          isSystem: false
        });
        
        // Trigger event for UI update
        this.triggerEvent('messageReceived', { messages: this.messages });
      }
    });

    // Listen for broadcast messages (for websocket-test.html compat)
    this.socket.on('broadcast_message', data => {
      const { message, sender } = data;
      
      this.messages.push({
        id: Date.now().toString(),
        text: message,
        username: sender || 'Unknown User',
        userId: 'broadcast_' + (sender || 'unknown'),
        timestamp: new Date().toISOString(),
        isSystem: false
      });
      
      // Trigger event for UI update
      this.triggerEvent('messageReceived', { messages: this.messages });
    });

    // Listen for room announcements
    this.socket.on('room_announcement', (message) => {
      this.addSystemMessage(message);
    });

    // Listen for room joined confirmation
    this.socket.on('room_joined', (room) => {
      this.addSystemMessage(`Joined room: ${room}`);
    });
    
    // Handle connection/reconnection
    this.socket.on('connect', () => {
      this.isConnected = true;
      this.addSystemMessage('Connected to chat server');
      this.triggerEvent('connectionUpdated', { connected: true });
      
      // Rejoin rooms on reconnection
      this.rooms.forEach(room => {
        this.socket.emit('join_room', room);
      });
    });
    
    // Handle disconnection
    this.socket.on('disconnect', () => {
      this.isConnected = false;
      this.addSystemMessage('Disconnected from chat server');
      this.triggerEvent('connectionUpdated', { connected: false });
    });

    // Listen for direct messages
    this.socket.on('direct_message', data => {
      const { message, from, fromUsername } = data;
      
      this.messages.push({
        id: Date.now().toString(),
        text: message,
        username: fromUsername || 'User',
        userId: from,
        timestamp: new Date().toISOString(),
        isSystem: false,
        isDirect: true
      });
      
      // Trigger event for UI update
      this.triggerEvent('messageReceived', { messages: this.messages });
    });

    // Handle user status updates
    this.socket.on('user:status', data => {
      const { userId, status } = data;
      
      // Update user status in our local users array
      const userIndex = this.users.findIndex(u => u.userId === userId);
      if (userIndex !== -1) {
        this.users[userIndex].status = status;
        this.triggerEvent('usersUpdated', { users: this.users, onlineUsers: this.onlineUsers });
      }
    });

    // Handle user disconnection
    this.socket.on('user:disconnect', (userId) => {
      // Find user who disconnected
      const userIndex = this.users.findIndex(u => u.userId === userId);
      if (userIndex !== -1) {
        const username = this.users[userIndex].username;
        this.addSystemMessage(`${username} has disconnected`);
      }
    });
  }
  
  /**
   * Send a message to the chat
   * @param {string} message - The message to send
   * @param {string} room - The room to send the message to (optional)
   * @param {string} userId - The user ID to send a direct message to (optional)
   * @returns {boolean} - Whether the message was sent successfully
   */
  sendMessage(message, room = null, userId = null) {
    if (!this.socket || !this.isConnected) {
      console.error('Cannot send message: Socket not connected');
      return false;
    }
    
    if (!message || typeof message !== 'string' || message.trim() === '') {
      console.error('Cannot send empty message');
      return false;
    }
    
    // Create message data
    const messageData = {
      username: this.username,
      userId: this.userId,
      message: message,
      timestamp: new Date().toISOString()
    };
    
    // If sending to a specific user (direct message)
    if (userId) {
      this.socket.emit('direct_message', {
        to: userId,
        message: message,
        from: this.userId,
        fromUsername: this.username
      });
      
      // Add message to our local messages array
      this.messages.push({
        id: Date.now().toString(),
        text: message,
        username: this.username,
        userId: this.userId,
        timestamp: new Date().toISOString(),
        isSystem: false,
        isDirect: true,
        toUserId: userId
      });
      
      this.triggerEvent('messageReceived', { messages: this.messages });
      return true;
    }
    
    // If sending to a specific room, or default to 'global' if not specified
    const targetRoom = room || 'global';
    this.socket.emit('room_message', {
      room: targetRoom,
      message: message
    });
    
    // Add message to our local messages array
    this.messages.push({
      id: Date.now().toString(),
      text: message,
      username: this.username,
      userId: this.userId,
      timestamp: new Date().toISOString(),
      isSystem: false,
      room: targetRoom
    });
    
    this.triggerEvent('messageReceived', { messages: this.messages });
    return true;
  }
  
  /**
   * Broadcast a message to all users
   * @param {string} message - The message to broadcast
   * @returns {boolean} - Whether the message was sent successfully
   */
  broadcastMessage(message) {
    if (!this.socket || !this.isConnected) {
      console.error('Cannot broadcast message: Socket not connected');
      return false;
    }
    
    if (!message || typeof message !== 'string' || message.trim() === '') {
      console.error('Cannot broadcast empty message');
      return false;
    }
    
    // Send broadcast message
    this.socket.emit('broadcast_message', {
      message: message,
      sender: this.username
    });
    
    // Add message to our local messages array
    this.messages.push({
      id: Date.now().toString(),
      text: message,
      username: this.username,
      userId: this.userId,
      timestamp: new Date().toISOString(),
      isSystem: false,
      isBroadcast: true
    });
    
    this.triggerEvent('messageReceived', { messages: this.messages });
    return true;
  }
  
  /**
   * Add a system message to the chat
   * @param {string} message - The system message to add
   */
  addSystemMessage(message) {
    this.messages.push({
      id: Date.now().toString(),
      text: message,
      username: 'System',
      userId: 'system',
      timestamp: new Date().toISOString(),
      isSystem: true
    });
    
    this.triggerEvent('messageReceived', { messages: this.messages });
  }
  
  /**
   * Set the currently selected user for direct messaging
   * @param {string} userId - The ID of the selected user
   */
  setSelectedUser(userId) {
    if (!userId) {
      this.selectedUser = null;
      return;
    }
    
    const user = this.users.find(u => u.userId === userId);
    if (user) {
      this.selectedUser = user;
      this.addSystemMessage(`Selected user: ${user.username}`);
    } else {
      console.error('Selected user not found:', userId);
    }
  }
  
  /**
   * Get all messages
   * @returns {Array} - List of chat messages
   */
  getMessages() {
    return this.messages;
  }
  
  /**
   * Get all users
   * @returns {Array} - List of users
   */
  getUsers() {
    return this.users;
  }
  
  /**
   * Get user by ID
   * @param {string} userId - The user ID to find
   * @returns {Object|null} - The user object or null
   */
  getUserById(userId) {
    return this.users.find(u => u.userId === userId) || null;
  }
  
  /**
   * Register an event handler
   * @param {string} event - The event name
   * @param {Function} callback - The callback function
   */
  on(event, callback) {
    if (!this.eventHandlers[event]) {
      this.eventHandlers[event] = [];
    }
    
    this.eventHandlers[event].push(callback);
  }
  
  /**
   * Trigger an event
   * @param {string} event - The event name
   * @param {Object} data - The event data
   */
  triggerEvent(event, data) {
    if (!this.eventHandlers[event]) return;
    
    this.eventHandlers[event].forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in event handler for ${event}:`, error);
      }
    });
  }
  
  /**
   * Clean up resources and disconnect
   */
  cleanup() {
    if (this.socket) {
      this.socket.disconnect();
    }
    
    this.messages = [];
    this.users = [];
    this.eventHandlers = {};
  }
}

// Export a singleton instance
const adminChatService = new AdminChatService();
export default adminChatService;
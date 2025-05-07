// client-side/admin/service/admin-chat-service.js

/**
 * Admin Chat Service Module
 * Handles chat functionality for the admin interface
 * Connects to the main websocket chat system
 */
export class AdminChatService {
  constructor() {
    this.socket = null;
    this.socketClient = null;
    this.username = 'Admin';
    this.userId = '';
    this.users = [];
    this.messages = [];
    this.onlineUsers = 0;
    this.eventHandlers = {};
    this.isConnected = false;
    this.rooms = ['global']; // Join only the global room by default
    this.selectedUser = null; // Track currently selected user for direct messaging
    this._welcomeShown = false; // Prevent duplicate welcome message
    this._joinedRooms = new Set(); // Track joined rooms
    this._roomJoinMessagesShown = new Set(); // Track room join system messages
    this._connecting = false; // Prevent parallel connection attempts
    this._eventsRegistered = false; // Prevent duplicate event handler registration
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
    
    // Add welcome message only once per session
    if (!this._welcomeShown) {
      this.addSystemMessage(`Welcome to the chat, ${this.username}!`);
      this._welcomeShown = true;
    }
    
    return this;
  }
  
  /**
   * Connect to the socket server
   */
  connectSocket() {
    // Prevent parallel connection attempts
    if (this.isConnected || this._connecting) {
      return;
    }
    this._connecting = true;
    try {
      import('/interac/client-side/client-socket/socket-client.js')
        .then(module => {
          const socketClient = module.default;
          this.socketClient = socketClient;
          
          // Store socket reference
          this.socket = socketClient.getSocket();
          
          if (!this.socket) {
            console.error('Failed to get socket instance');
            this._connecting = false;
            return;
          }
          
          // Only connect if not already connected
          if (!this.socket.connected) {
            // Connect with proper user identification
            socketClient.connectWithUsername(this.username);
            
            // Update our userId to match what the socketClient assigns
            this.userId = socketClient.userId;
          }
          
          // Register socket events only once
          if (!this._eventsRegistered) {
            this.registerSocketEvents();
            this._eventsRegistered = true;
          }
          
          // Join admin room and global room for communication with all clients
          this.rooms.forEach(room => {
            if (!this._joinedRooms.has(room)) {
              socketClient.joinRoom(room);
              this._joinedRooms.add(room);
              console.log(`Joining room: ${room}`);
            }
          });
          
          this.isConnected = true;
          this._connecting = false;
        })
        .catch(err => {
          console.error('Error importing socket client:', err);
          this._connecting = false;
        });
    } catch (error) {
      console.error('Error connecting to socket server:', error);
      this._connecting = false;
    }
  }
  
  /**
   * Register socket events for chat
   */
  registerSocketEvents() {
    if (!this.socket) return;
    
    // When receiving the user list
    this.socket.on('users_online', (users) => {
      console.log('Received users_online event:', users);
      this.processUserList(users);
    });

    // Also listen for user_list event from socket-client.js
    this.socket.on('user_list', (users) => {
      console.log('Received user_list event:', users);
      this.processUserList(users);
    });
    
    // When receiving a new message from index.html
    this.socket.on('chat_message', data => {
      const { message, username, userId } = data;
      
      this.messages.push({
        id: Date.now().toString(),
        text: message,
        username: username || 'Unknown User',
        userId: userId || 'unknown_user',
        timestamp: new Date().toISOString(),
        isSystem: false
      });
      
      // Trigger event for UI update
      this.triggerEvent('messageReceived', { messages: this.messages });
    });

    // Handle room messages for communication with websocket-test.html
    this.socket.on('room_message', data => {
      const { message, user, room } = data;
      
      // Accept messages only from the global room
      if (room === 'global') {
        this.messages.push({
          id: Date.now().toString(),
          text: message,
          username: typeof user === 'object' ? (user.username || user.name || 'Unknown User') : user,
          userId: typeof user === 'object' ? (user.userId || user.id || 'client_unknown') : ('client_' + user),
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
      if (!this._roomJoinMessagesShown.has(room)) {
        this.addSystemMessage(`Joined room: ${room}`);
        this._roomJoinMessagesShown.add(room);
      }
    });
    
    // Handle connection/reconnection
    this.socket.on('connect', () => {
      this.isConnected = true;
      if (!this._connectionMessageShown) {
        this.addSystemMessage('Connected to chat server');
        this._connectionMessageShown = true;
      }
      this.triggerEvent('connectionUpdated', { connected: true });
      // Do NOT rejoin rooms here to avoid duplicate join_room emits and system messages
      // Room join is handled only in connectSocket()
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
   * Process user list data from socket events
   * @param {Array} users - Array of user objects or strings
   */
  processUserList(users) {
    if (!Array.isArray(users)) {
      console.warn('Received invalid user list format:', users);
      return;
    }
    
    this.users = users.map(user => {
      // Handle different user data formats
      if (typeof user === 'string') {
        return { 
          userId: 'user_' + user, 
          username: user, 
          status: 'online' 
        };
      } else if (typeof user === 'object' && user !== null) {
        return {
          userId: user.userId || user.id || 'unknown_' + Date.now(),
          username: user.username || user.name || 'Anonymous',
          status: user.status || 'online'
        };
      }
      return { 
        userId: 'unknown', 
        username: 'Unknown User', 
        status: 'online' 
      };
    });
    
    this.onlineUsers = this.users.length;
    
    // Log processed users for debugging
    console.log('Processed user list:', this.users);
    
    // Trigger UI update
    this.triggerEvent('usersUpdated', { 
      users: this.users, 
      onlineUsers: this.onlineUsers 
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
    
    // If we have the socketClient, use its sendChatMessage method
    if (this.socketClient) {
      if (userId) {
        // Direct message
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
      } else {
        // Regular message
        this.socketClient.sendChatMessage(message, room || 'global');
      }
      return true;
    }
    
    // Fallback to direct socket emit if socketClient not available
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
    // For global chat, emit chat_message with username and userId
    this.socket.emit('chat_message', messageData);
    // Do NOT add the message to messages array here; wait for server echo
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
    } else {
      console.warn(`User with ID ${userId} not found`);
      this.selectedUser = null;
    }
  }
  
  /**
   * Register an event handler
   * @param {string} event - The event to register for
   * @param {Function} callback - The callback to execute when the event occurs
   */
  on(event, callback) {
    if (!this.eventHandlers[event]) {
      this.eventHandlers[event] = [];
    }
    this.eventHandlers[event].push(callback);
  }
  
  /**
   * Trigger an event
   * @param {string} event - The event to trigger
   * @param {Object} data - The data to pass to the event handlers
   */
  triggerEvent(event, data) {
    if (this.eventHandlers[event]) {
      this.eventHandlers[event].forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in ${event} event handler:`, error);
        }
      });
    }
  }
  
  /**
   * Get the message history
   * @returns {Array} - The message history
   */
  getMessages() {
    return this.messages;
  }
  
  /**
   * Get the list of online users
   * @returns {Array} - The list of online users
   */
  getUsers() {
    return this.users;
  }
  
  /**
   * Get the number of online users
   * @returns {number} - The number of online users
   */
  getOnlineUserCount() {
    return this.onlineUsers;
  }
  
  /**
   * Check if the socket is connected
   * @returns {boolean} - Whether the socket is connected
   */
  isSocketConnected() {
    return this.isConnected;
  }
  
  /**
   * Disconnect from the socket server
   */
  disconnect() {
    if (this.socketClient) {
      this.socketClient.disconnect();
    }
    this.isConnected = false;
  }
}

// Create and export a singleton instance
const adminChatService = new AdminChatService();
export default adminChatService;
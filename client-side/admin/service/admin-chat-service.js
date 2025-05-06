// client-side/admin/service/admin-chat-service.js

/**
 * Admin Chat Service Module
 * Handles chat functionality for the admin interface
 */
export class AdminChatService {
  constructor() {
    this.socket = null;
    this.currentChannel = 'general';
    this.username = '';
    this.userId = '';
    this.users = [];
    this.channels = [
      { id: 'general', name: 'general', isDefault: true },
      { id: 'support', name: 'support', isDefault: false }
    ];
    this.messages = {};
    this.onlineUsers = 0;
    this.eventHandlers = {};
  }

  /**
   * Initialize the chat service
   * @param {string} username - The username of the current admin
   * @param {string} userId - The user ID of the current admin
   */
  init(username, userId) {
    this.username = username;
    this.userId = userId;
    
    // Initialize messages containers for each channel
    this.channels.forEach(channel => {
      if (!this.messages[channel.id]) {
        this.messages[channel.id] = [];
      }
    });
    
    // Connect to socket server
    this.connectSocket();
    
    // Set up default event handlers
    this.setUpEventListeners();
    
    console.log('Admin Chat Service initialized for user:', username);
    
    // Add system message to all channels
    this.channels.forEach(channel => {
      this.addSystemMessage(channel.id, `Welcome to the #${channel.name} channel`);
    });
    
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
          const SocketClient = module.default;
          this.socket = SocketClient.getSocket();
          
          if (!this.socket) {
            console.error('Failed to get socket instance');
            return;
          }
          
          console.log('Connected to socket server for admin chat');
          
          // Register socket events
          this.registerSocketEvents();
          
          // Join admin chat room
          this.socket.emit('admin:join', {
            userId: this.userId,
            username: this.username
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
    
    // When a new user joins
    this.socket.on('admin:user-joined', data => {
      this.onlineUsers = data.onlineUsers;
      this.users = data.users;
      this.triggerEvent('usersUpdated', { users: this.users, onlineUsers: this.onlineUsers });
      
      // Add system message
      this.addSystemMessage(this.currentChannel, `${data.username} joined the chat`);
    });
    
    // When receiving the full user list (including regular users)
    this.socket.on('admin:user-list', userList => {
      // Update our user list with regular users
      userList.forEach(regularUser => {
        // Only add if not already in the list
        if (!this.users.some(u => u.userId === regularUser.userId)) {
          this.users.push({
            ...regularUser,
            isRegularUser: true
          });
        }
      });
      
      this.onlineUsers = this.users.length;
      this.triggerEvent('usersUpdated', { users: this.users, onlineUsers: this.onlineUsers });
    });
    
    // When a user leaves
    this.socket.on('admin:user-left', data => {
      this.onlineUsers = data.onlineUsers;
      this.users = data.users;
      this.triggerEvent('usersUpdated', { users: this.users, onlineUsers: this.onlineUsers });
      
      // Add system message
      this.addSystemMessage(this.currentChannel, `${data.username} left the chat`);
    });
    
    // When receiving a new message
    this.socket.on('admin:message', message => {
      const { channelId, text, username, timestamp, userId } = message;
      
      // Store message in appropriate channel
      if (!this.messages[channelId]) {
        this.messages[channelId] = [];
      }
      
      this.messages[channelId].push({
        id: Date.now().toString(),
        text,
        username,
        userId,
        timestamp,
        isSystem: false
      });
      
      // Trigger event for UI update
      this.triggerEvent('messageReceived', { 
        channelId, 
        messages: this.messages[channelId] 
      });
    });
    
    // When receiving channel list update
    this.socket.on('admin:channels-updated', data => {
      this.channels = data.channels;
      this.triggerEvent('channelsUpdated', { channels: this.channels });
    });
  }
  
  /**
   * Send a message to a channel
   * @param {string} text - Message text
   * @param {string} channelId - Channel ID
   */
  sendMessage(text, channelId = this.currentChannel) {
    if (!text.trim() || !this.socket) return;
    
    const message = {
      text,
      channelId,
      username: this.username,
      userId: this.userId,
      timestamp: new Date().toISOString()
    };
    
    this.socket.emit('admin:send-message', message);
    
    // Optimistically add to local messages
    if (!this.messages[channelId]) {
      this.messages[channelId] = [];
    }
    
    this.messages[channelId].push({
      id: Date.now().toString(),
      ...message,
      isSystem: false
    });
    
    // Trigger event for UI update
    this.triggerEvent('messageReceived', { 
      channelId, 
      messages: this.messages[channelId] 
    });
    
    return true;
  }
  
  /**
   * Add a system message to a channel
   * @param {string} channelId - Channel ID
   * @param {string} text - System message text
   */
  addSystemMessage(channelId, text) {
    if (!this.messages[channelId]) {
      this.messages[channelId] = [];
    }
    
    this.messages[channelId].push({
      id: Date.now().toString(),
      text,
      timestamp: new Date().toISOString(),
      isSystem: true
    });
    
    // Trigger event for UI update
    this.triggerEvent('messageReceived', { 
      channelId, 
      messages: this.messages[channelId] 
    });
  }
  
  /**
   * Switch to a different channel
   * @param {string} channelId - Channel ID to switch to
   */
  switchChannel(channelId) {
    if (channelId === this.currentChannel) return;
    
    this.currentChannel = channelId;
    
    // Initialize messages array if it doesn't exist
    if (!this.messages[channelId]) {
      this.messages[channelId] = [];
    }
    
    // Trigger event for UI update
    this.triggerEvent('channelSwitched', { 
      channelId, 
      messages: this.messages[channelId] 
    });
    
    return true;
  }
  
  /**
   * Create a new channel
   * @param {string} channelName - Name of the new channel
   */
  createChannel(channelName) {
    if (!channelName.trim() || !this.socket) return false;
    
    // Sanitize channel name (lowercase, no spaces)
    const sanitizedName = channelName.toLowerCase().replace(/\s+/g, '-');
    
    // Check if channel already exists
    if (this.channels.some(c => c.id === sanitizedName)) {
      return false;
    }
    
    const newChannel = {
      id: sanitizedName,
      name: channelName,
      isDefault: false
    };
    
    this.socket.emit('admin:create-channel', newChannel);
    
    // Optimistically add to local channels
    this.channels.push(newChannel);
    this.messages[sanitizedName] = [];
    
    // Trigger event for UI update
    this.triggerEvent('channelsUpdated', { channels: this.channels });
    
    // Add system message
    this.addSystemMessage(sanitizedName, `Channel #${channelName} created`);
    
    return true;
  }
  
  /**
   * Get messages for a specific channel
   * @param {string} channelId - Channel ID
   * @returns {Array} - Array of messages
   */
  getMessages(channelId = this.currentChannel) {
    return this.messages[channelId] || [];
  }
  
  /**
   * Get all channels
   * @returns {Array} - Array of channels
   */
  getChannels() {
    return this.channels;
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
   * Set up event listeners for HTML elements
   */
  setUpEventListeners() {
    // These will be set up in the admin-main.js file
  }
  
  /**
   * Clean up resources when chat is closed
   */
  cleanup() {
    if (this.socket) {
      this.socket.off('admin:user-joined');
      this.socket.off('admin:user-left');
      this.socket.off('admin:message');
      this.socket.off('admin:channels-updated');
    }
    
    this.eventHandlers = {};
  }
}

// Export a singleton instance
const adminChatService = new AdminChatService();
export default adminChatService;
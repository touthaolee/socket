// server-side/server-socket/socket-handlers.js
const authService = require('../server-services/auth-service');

// Store users, admin users and channels
const users = [];
const adminUsers = [];
const adminChannels = [
  { id: 'general', name: 'general', isDefault: true },
  { id: 'support', name: 'support', isDefault: false }
];

/**
 * Set up Socket.io authentication middleware
 * @param {Object} io - Socket.io server instance
 */
function setupAuthMiddleware(io) {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      const username = socket.handshake.auth.username;
      
      // Allow simple username authentication for any client
      if (username && !token) {
        socket.username = username;
        socket.user = {
          id: socket.id,
          username: username
        };
        return next();
      }
      
      // Regular authentication flow with token (if token is provided)
      if (token) {
        try {
          // Verify token
          const decoded = authService.verifyToken(token);
          if (!decoded) {
            return next(new Error('Invalid authentication token'));
          }
          
          // Find user
          const user = await authService.findUserById(decoded.id);
          if (!user) {
            return next(new Error('User not found'));
          }
          
          // Store user data in socket
          socket.user = {
            id: user.id,
            username: user.username
          };
          
          return next();
        } catch (tokenError) {
          console.error('Token verification error:', tokenError);
          return next(new Error('Authentication token error'));
        }
      }
      
      // Neither username nor token provided
      return next(new Error('Authentication required: provide either username or token'));
    } catch (error) {
      console.error('Socket authentication error:', error);
      next(new Error('Authentication error'));
    }
  });
}

/**
 * Handle new socket connection
 * @param {Object} io - Socket.io server instance
 * @param {Object} socket - Socket instance
 */
function handleConnection(io, socket) {
  console.log(`User connected: ${socket.user.username} (${socket.id})`);
  
  // Add user to the global users list
  const userInfo = {
    userId: socket.id, // Use socket.id as userId for non-authenticated users
    username: socket.user.username,
    status: 'online',
    isRegularUser: true
  };
  
  // Check if user already exists
  const existingIndex = users.findIndex(u => u.userId === userInfo.userId);
  if (existingIndex === -1) {
    users.push(userInfo);
  } else {
    users[existingIndex] = userInfo;
  }
  
  // Broadcast updated user list to all clients
  broadcastUserList(io);
  // Also broadcast to admin chat
  broadcastUsersToAdmins(io);
}

/**
 * Handle socket disconnection
 * @param {Object} io - Socket.io server instance
 * @param {Object} socket - Socket instance
 */
function handleDisconnect(io, socket) {
  console.log(`User disconnected: ${socket.user?.username || 'Unknown'} (${socket.id})`);
  
  // Remove the user from our global users array
  const index = users.findIndex(u => u.userId === socket.id);
  if (index !== -1) {
    const disconnectedUser = users[index];
    users.splice(index, 1);
    
    // Notify admins about disconnected user
    io.to('admin-chat').emit('user:disconnect', disconnectedUser.userId);
  }
  
  // Broadcast updated user lists
  broadcastUserList(io);
  broadcastUsersToAdmins(io);
}

/**
 * Register chat-related event handlers
 * @param {Object} io - Socket.io server instance
 * @param {Object} socket - Socket instance
 */
function registerChatHandlers(io, socket) {
  // Handle user joining
  socket.on('user_join', (username) => {
    // If username is provided (from websocket-test), use it
    if (username && typeof username === 'string') {
      console.log(`${username} joined the chat`);
    } else {
      console.log(`${socket.user.username} joined the chat`);
    }
    
    // Broadcast updated user list
    broadcastUserList(io);
    
    // Also update the admin chat with this new user
    broadcastUsersToAdmins(io);
  });
  
  // Handle chat messages
  socket.on('chat_message', (data) => {
    const messageData = {
      userId: socket.id,
      username: socket.user.username,
      message: data.message,
      timestamp: new Date().toISOString()
    };
    
    // Broadcast to all clients
    io.emit('chat_message', messageData);
    
    // Also forward messages to admin chat
    io.to('admin-chat').emit('chat_message', messageData);
  });
  
  // Handle user info sharing with admin
  socket.on('user:share-with-admin', (userData) => {
    // Forward the user data to admin chat room
    io.to('admin-chat').emit('user:share-with-admin', userData);
  });
  
  // Add test event handlers for websocket-test.html
  registerTestEventHandlers(io, socket);
}

/**
 * Register test-related event handlers
 * @param {Object} io - Socket.io server instance
 * @param {Object} socket - Socket instance
 */
function registerTestEventHandlers(io, socket) {
  // Test event
  socket.on('test_event', (data) => {
    console.log('[Test] Received test_event from', socket.id, data);
    socket.emit('test_response', { 
      status: 'ok', 
      received: data, 
      serverTime: new Date().toISOString() 
    });
  });
  
  // Custom ping-pong for latency testing
  socket.on('custom_ping', (data) => {
    console.log('[Ping] Received custom_ping from', socket.id, data);
    socket.emit('custom_pong', { serverTime: new Date().toISOString() });
  });
  
  // Acknowledgement test handler
  socket.on('ack_test', (data, callback) => {
    console.log('[Ack Test] Received ack_test from', socket.id, data);
    if (typeof callback === 'function') {
      callback({ 
        status: 'acknowledged', 
        received: data, 
        serverTime: new Date().toISOString() 
      });
    }
  });
  
  // Room management
  socket.on('join_room', (room) => {
    console.log(`[Room] ${socket.user.username} joined room ${room}`);
    socket.join(room);
    socket.emit('room_joined', room);
    io.to(room).emit('room_announcement', `${socket.user.username} joined room ${room}`);
  });
  
  socket.on('leave_room', (room) => {
    console.log(`[Room] ${socket.user.username} left room ${room}`);
    socket.leave(room);
    socket.emit('room_left', room);
    io.to(room).emit('room_announcement', `${socket.user.username} left room ${room}`);
  });
  
  socket.on('room_message', ({ room, message }) => {
    console.log(`[Room] Message in ${room} from ${socket.user.username}: ${message}`);
    io.to(room).emit('room_message', {
      user: socket.user.username,
      message,
      timestamp: new Date().toISOString(),
      room
    });
  });
  
  // Broadcast message
  socket.on('broadcast_message', (data) => {
    console.log(`[Broadcast] Message from ${socket.user.username}: ${data.message}`);
    socket.broadcast.emit('broadcast_message', { 
      from: socket.user.username, 
      message: data.message 
    });
  });
}

/**
 * Register all event handlers
 * @param {Object} io - Socket.io server instance
 * @param {Object} socket - Socket instance
 */
function registerEventHandlers(io, socket) {
  // Register chat handlers
  registerChatHandlers(io, socket);
  
  // Register admin chat handlers
  registerAdminChatHandlers(io, socket);
  
  // Register quiz handlers
  registerQuizHandlers(io, socket);
}

/**
 * Register admin chat event handlers
 * @param {Object} io - Socket.io server instance
 * @param {Object} socket - Socket instance
 */
function registerAdminChatHandlers(io, socket) {
  // Admin joining chat
  socket.on('admin:join', (data) => {
    console.log(`Admin joined: ${data.username} (${data.userId})`);
    
    // Store admin user data in socket
    socket.isAdmin = true;
    socket.adminUser = {
      userId: data.userId,
      username: data.username,
      status: 'online'
    };
    
    // Add user to admin users list if not already present
    if (!adminUsers.some(user => user.userId === data.userId)) {
      adminUsers.push(socket.adminUser);
    }
    
    // Join admin room
    socket.join('admin-chat');
    
    // Broadcast updated user list
    broadcastAdminUserList(io);
    
    // Send the regular users list to this admin
    broadcastUsersToAdmins(io);
  });
  
  // Admin sending message
  socket.on('admin:send-message', (message) => {
    console.log(`Admin message from ${message.username} in channel ${message.channelId}: ${message.text}`);
    
    // Broadcast to all admins
    io.to('admin-chat').emit('admin:message', {
      id: Date.now().toString(),
      channelId: message.channelId,
      text: message.text,
      username: message.username,
      userId: message.userId,
      timestamp: message.timestamp || new Date().toISOString()
    });
    
    // If it's in the general channel, also broadcast to regular clients
    if (message.channelId === 'general') {
      io.emit('chat_message', {
        userId: message.userId,
        username: `Admin: ${message.username}`,
        message: message.text,
        timestamp: message.timestamp || new Date().toISOString()
      });
    }
  });
  
  // Admin creating a new channel
  socket.on('admin:create-channel', (channel) => {
    console.log(`Admin ${socket.adminUser?.username} created channel: ${channel.name}`);
    
    // Check if channel already exists
    if (!adminChannels.some(c => c.id === channel.id)) {
      adminChannels.push(channel);
      
      // Broadcast updated channel list
      io.to('admin-chat').emit('admin:channels-updated', {
        channels: adminChannels
      });
    }
  });
  
  // Handle disconnect
  socket.on('disconnect', () => {
    if (socket.isAdmin && socket.adminUser) {
      console.log(`Admin disconnected: ${socket.adminUser.username}`);
      
      // Remove user from admin users list
      const index = adminUsers.findIndex(user => user.userId === socket.adminUser.userId);
      if (index !== -1) {
        adminUsers.splice(index, 1);
      }
      
      // Broadcast updated user list
      broadcastAdminUserList(io);
    }
  });
}

/**
 * Register quiz-related event handlers
 * @param {Object} io - Socket.io server instance
 * @param {Object} socket - Socket instance
 */
function registerQuizHandlers(io, socket) {
  // This function is a placeholder for quiz-related socket events
  // Quiz functionality can be implemented here as needed
  
  // User quiz start
  socket.on('quiz:start', (quizId) => {
    console.log(`User ${socket.user.username} started quiz ${quizId}`);
  });
  
  // User quiz submission
  socket.on('quiz:submit', (data) => {
    console.log(`User ${socket.user.username} submitted quiz ${data.quizId}`);
  });
}

/**
 * Broadcast active users list to all clients
 * @param {Object} io - Socket.io server instance
 */
function broadcastUserList(io) {
  // Emit updated user list to all clients
  io.emit('users_online', users);
  
  // Also emit with the event name 'user_list' for the websocket-test.html client
  io.emit('user_list', users);
}

/**
 * Broadcast active users to admin chat
 * @param {Object} io - Socket.io server instance
 */
function broadcastUsersToAdmins(io) {
  const userList = users.map(u => ({
    userId: u.userId,
    username: u.username,
    status: u.status,
    isRegularUser: true
  }));
  
  io.to('admin-chat').emit('admin:user-list', userList);
}

/**
 * Broadcast admin users list to all admins
 * @param {Object} io - Socket.io server instance
 */
function broadcastAdminUserList(io) {
  // Combine admin users and regular users for the admin chat
  const allUsers = [...adminUsers];
  
  // Add regular users to the list if they're not already in adminUsers
  users.forEach(user => {
    if (!allUsers.some(admin => admin.userId === user.userId)) {
      allUsers.push({
        ...user,
        isRegularUser: true
      });
    }
  });
  
  io.to('admin-chat').emit('admin:user-joined', {
    users: allUsers,
    onlineUsers: allUsers.length,
    username: adminUsers.length > 0 ? adminUsers[adminUsers.length - 1].username : 'Unknown'
  });
}

module.exports = {
  setupAuthMiddleware,
  handleConnection,
  handleDisconnect,
  registerChatHandlers,
  registerAdminChatHandlers,
  registerTestEventHandlers,
  registerQuizHandlers,
  registerEventHandlers
};
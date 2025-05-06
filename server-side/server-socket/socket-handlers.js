// server-side/server-socket/socket-handlers.js
const authService = require('../server-services/auth-service');
const logger = require('../../logger');

// Store users, admin users and channels
const users = [];
const adminUsers = [];

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
          logger.error('Token verification error:', tokenError);
          return next(new Error('Authentication token error'));
        }
      }
      
      // Neither username nor token provided
      return next(new Error('Authentication required: provide either username or token'));
    } catch (error) {
      logger.error('Socket authentication error:', error);
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
  logger.info(`User connected: ${socket.user.username} (${socket.id})`);
  
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
}

/**
 * Handle socket disconnection
 * @param {Object} io - Socket.io server instance
 * @param {Object} socket - Socket instance
 */
function handleDisconnect(io, socket) {
  logger.info(`User disconnected: ${socket.user?.username || 'Unknown'} (${socket.id})`);
  
  // Remove the user from our global users array
  const index = users.findIndex(u => u.userId === socket.id);
  if (index !== -1) {
    const disconnectedUser = users[index];
    users.splice(index, 1);
    
    // Notify about disconnected user to all rooms
    io.emit('user:disconnect', disconnectedUser.userId);
  }
  
  // Broadcast updated user lists
  broadcastUserList(io);
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
      logger.info(`${username} joined the chat`);
    } else {
      logger.info(`${socket.user.username} joined the chat`);
    }
    
    // Broadcast updated user list
    broadcastUserList(io);
  });
  
  // Handle chat messages
  socket.on('chat_message', (data) => {
    const messageData = {
      userId: socket.id,
      username: data.username || socket.user.username,
      message: data.message,
      timestamp: new Date().toISOString()
    };
    
    // Broadcast to all clients
    io.emit('chat_message', messageData);
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
    logger.info('[Test] Received test_event from', socket.id, data);
    socket.emit('test_response', { 
      status: 'ok', 
      received: data, 
      serverTime: new Date().toISOString() 
    });
  });
  
  // Custom ping-pong for latency testing
  socket.on('custom_ping', (data) => {
    logger.info('[Ping] Received custom_ping from', socket.id, data);
    socket.emit('custom_pong', { serverTime: new Date().toISOString() });
  });
  
  // Acknowledgement test handler
  socket.on('ack_test', (data, callback) => {
    logger.info('[Ack Test] Received ack_test from', socket.id, data);
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
    logger.info(`[Room] ${socket.user.username} joined room ${room}`);
    socket.join(room);
    socket.emit('room_joined', room);
    io.to(room).emit('room_announcement', `${socket.user.username} joined room ${room}`);
    
    // Update user lists for the room
    const roomUsers = getUsersInRoom(io, room);
    io.to(room).emit('room_users', roomUsers);
  });
  
  socket.on('leave_room', (room) => {
    logger.info(`[Room] ${socket.user.username} left room ${room}`);
    socket.leave(room);
    socket.emit('room_left', room);
    io.to(room).emit('room_announcement', `${socket.user.username} left room ${room}`);
    
    // Update user lists for the room
    const roomUsers = getUsersInRoom(io, room);
    io.to(room).emit('room_users', roomUsers);
  });
  
  socket.on('room_message', ({ room, message }) => {
    logger.info(`[Room] Message in ${room} from ${socket.user.username}: ${message}`);
    io.to(room).emit('room_message', {
      user: socket.user.username,
      message,
      timestamp: new Date().toISOString(),
      room
    });
  });
  
  // Broadcast message
  socket.on('broadcast_message', (data) => {
    logger.info(`[Broadcast] Message from ${socket.user.username}: ${data.message}`);
    socket.broadcast.emit('broadcast_message', { 
      from: socket.user.username, 
      message: data.message 
    });
  });
}

/**
 * Get users in a specific room
 * @param {Object} io - Socket.io server instance
 * @param {string} room - Room name
 * @returns {Array} - Array of users in the room
 */
function getUsersInRoom(io, room) {
  const roomSockets = io.sockets.adapter.rooms.get(room);
  const roomUsers = [];
  
  if (roomSockets) {
    for (const socketId of roomSockets) {
      const socket = io.sockets.sockets.get(socketId);
      if (socket && socket.user) {
        roomUsers.push({
          userId: socketId,
          username: socket.user.username,
          status: 'online'
        });
      }
    }
  }
  
  return roomUsers;
}

/**
 * Register all event handlers
 * @param {Object} io - Socket.io server instance
 * @param {Object} socket - Socket instance
 */
function registerEventHandlers(io, socket) {
  // Register chat handlers
  registerChatHandlers(io, socket);
  
  // Register quiz handlers
  registerQuizHandlers(io, socket);
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
    logger.info(`User ${socket.user.username} started quiz ${quizId}`);
  });
  
  // User quiz submission
  socket.on('quiz:submit', (data) => {
    logger.info(`User ${socket.user.username} submitted quiz ${data.quizId}`);
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

module.exports = {
  setupAuthMiddleware,
  handleConnection,
  handleDisconnect,
  registerChatHandlers,
  registerTestEventHandlers,
  registerQuizHandlers,
  registerEventHandlers
};
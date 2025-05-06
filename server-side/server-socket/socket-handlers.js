// server-side/server-socket/socket-handlers.js
const authService = require('../server-services/auth-service');

/**
 * Set up Socket.io authentication middleware
 * @param {Object} io - Socket.io server instance
 */
function setupAuthMiddleware(io) {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      const username = socket.handshake.auth.username;
      
      // Allow simple username authentication for testing tools
      if (username && !token && socket.handshake.headers.referer && 
          socket.handshake.headers.referer.includes('websocket-test.html')) {
        socket.username = username;
        socket.user = {
          id: socket.id,
          username: username
        };
        return next();
      }
      
      // Regular authentication flow with token
      if (!token) {
        return next(new Error('Authentication token required'));
      }
      
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
      
      next();
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
}

/**
 * Handle socket disconnection
 * @param {Object} io - Socket.io server instance
 * @param {Object} socket - Socket instance
 */
function handleDisconnect(io, socket) {
  console.log(`User disconnected: ${socket.user?.username || 'Unknown'} (${socket.id})`);
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
      console.log(`${username} joined the chat`);
    } else {
      console.log(`${socket.user.username} joined the chat`);
    }
    broadcastUserList(io);
  });
  
  // Handle chat messages
  socket.on('chat_message', (data) => {
    io.emit('chat_message', {
      user: socket.user.username,
      message: data.message,
      timestamp: new Date().toISOString()
    });
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
 * Broadcast active users list to all clients
 * @param {Object} io - Socket.io server instance
 */
function broadcastUserList(io) {
  const users = [];
  for (const [id, socket] of io.sockets.sockets) {
    if (socket.user) {
      users.push({
        id: socket.user.id,
        username: socket.user.username
      });
    }
  }
  io.emit('user_list', users);
}

module.exports = {
  setupAuthMiddleware,
  handleConnection,
  handleDisconnect,
  registerChatHandlers,
  registerTestEventHandlers
};
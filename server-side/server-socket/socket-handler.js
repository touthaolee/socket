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
  socket.on('user_join', () => {
    console.log(`${socket.user.username} joined the chat`);
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
  registerChatHandlers
};
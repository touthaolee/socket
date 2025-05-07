// server-side/server-socket/socket-events.js
const { Server } = require('socket.io');
const { setupAuthMiddleware, handleDisconnect, registerQuizHandlers, registerChatHandlers } = require('./socket-handlers');

let io;

/**
 * Initialize Socket.io server with authentication middleware
 * @param {Object} server - HTTP server instance
 * @returns {Object} Socket.io server instance
 */
function initSocketServer(server) {
  // Create Socket.io server with enhanced configuration
  io = new Server(server, {
    path: '/interac/socket.io',
    cors: {
      origin: "*", // Allow connections from any origin (adjust for production)
      methods: ["GET", "POST"]
    },
    // Connection stability enhancements
    pingTimeout: 60000,           // How long to wait after a ping before considering connection closed
    pingInterval: 25000,          // How often to ping clients
    upgradeTimeout: 10000,        // How long to wait for an upgrade to WebSocket
    transports: ['websocket', 'polling'], // Allow fallback to polling if WebSocket fails
    allowEIO3: true,              // Allow compatibility with Socket.IO v2 clients
    connectTimeout: 45000,        // Connection timeout
    maxHttpBufferSize: 1e6        // 1MB max payload size
  });
  
  // Set up authentication middleware
  setupAuthMiddleware(io);
  
  // Helper to emit the user list to all clients
  function emitUserList() {
    const users = Array.from(io.sockets.sockets.values()).map(s => ({
      userId: s.user?.id || s.id,
      username: s.user?.username || 'Anonymous'
    }));
    io.emit('user_list', users);
  }

  // Connection handling
  io.on('connection', (socket) => {
    registerQuizHandlers(io, socket);
    registerChatHandlers(io, socket); // Register chat handlers
    emitUserList(); // Emit on connect

    // Handle disconnect
    socket.on('disconnect', () => {
      handleDisconnect(io, socket);
      emitUserList(); // Emit on disconnect
    });
  });
  
  // Log connection error events for debugging
  io.engine.on('connection_error', (err) => {
    console.error('Connection error:', err);
  });
  
  return io;
}

/**
 * Get the Socket.io server instance
 * @returns {Object} Socket.io server instance
 */
function getIo() {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
}

module.exports = {
  initSocketServer,
  getIo
};
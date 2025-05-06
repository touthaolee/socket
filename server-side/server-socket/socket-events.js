// server-side/server-socket/socket-events.js
const { Server } = require('socket.io');
const { setupAuthMiddleware, handleDisconnect, registerChatHandlers, registerQuizHandlers } = require('./socket-handlers');

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
  
  // Connection handling
  io.on('connection', (socket) => {
    // handleConnection(io, socket); // Removed: this function does not exist or is not needed
    
    // Register event handlers
    registerChatHandlers(io, socket);
    registerQuizHandlers(io, socket); // Add this line
    
    // Handle disconnect
    socket.on('disconnect', () => {
      handleDisconnect(io, socket);
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
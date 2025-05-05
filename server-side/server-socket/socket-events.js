// server-side/server-socket/socket-events.js
const { Server } = require('socket.io');
const { setupAuthMiddleware } = require('./socket-handlers');
const { handleConnection, handleDisconnect, registerChatHandlers } = require('./socket-handlers');

let io;

/**
 * Initialize Socket.io server with authentication middleware
 * @param {Object} server - HTTP server instance
 * @returns {Object} Socket.io server instance
 */
function initSocketServer(server) {
  // Create Socket.io server
  io = new Server(server, {
    path: '/interac/socket.io',
    cors: {
      origin: "*", // Allow connections from any origin (adjust for production)
      methods: ["GET", "POST"]
    }
  });
  
  // Set up authentication middleware
  setupAuthMiddleware(io);
  
  // Connection handling
  io.on('connection', (socket) => {
    handleConnection(io, socket);
    
    // Register event handlers
    registerChatHandlers(io, socket);
    
    // Handle disconnect
    socket.on('disconnect', () => {
      handleDisconnect(io, socket);
    });
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
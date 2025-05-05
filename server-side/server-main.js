/**
 * Server initialization for Interactive Quiz Application
 */
const express = require('express');
const router = express.Router();

/**
 * Initialize server components
 * @param {Express} app - Express application
 * @param {Server} server - HTTP server
 * @param {SocketIO.Server} io - Socket.io server
 */
function initServer(app, server, io) {
  console.log('Initializing server components...');
  
  // Initialize API routes
  app.use('/interac/api/auth', router);
  app.use('/interac/api/quiz', router);
  
  // Initialize Socket.io connection
  io.on('connection', (socket) => {
    console.log('A user connected');
    
    socket.on('disconnect', () => {
      console.log('User disconnected');
    });
  });
  
  console.log('Server components initialized successfully');
}

module.exports = initServer;
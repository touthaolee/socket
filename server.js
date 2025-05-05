/**
 * Main server entry point for Interactive Quiz Application
 */
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

// Import configuration
const config = require('./config/app-config');

// Import server initialization
const initServer = require('./server-side/server-main');

// Create Express app and HTTP server
const app = express();
const server = http.createServer(app);

// Initialize Socket.io
const io = new Server(server, {
  path: '/interac/socket.io',
  cors: {
    origin: "*", // Adjust for production
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(express.json());
app.use('/interac', express.static(path.join(__dirname, 'client-side')));

// Routes
app.get('/interac', (req, res) => {
  res.sendFile(path.join(__dirname, 'client-side', 'index.html'));
});

app.get('/interac/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'client-side', 'admin.html'));
});

// Initialize server with Express app and Socket.io instance
initServer(app, server, io);

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Access the application at: http://localhost:${PORT}/interac`);
});
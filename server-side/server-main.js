// server-side/server-main.js
const express = require('express');
const http = require('http');
const path = require('path');
const cookieParser = require('cookie-parser');
const { initSocketServer } = require('./server-socket/socket-events');
const config = require('../config/app-config');

// Import API routes
const authRoutes = require('./server-api/api-auth');
const quizRoutes = require('./server-api/api-quiz');

// Create Express app and HTTP server
const app = express();
const server = http.createServer(app);

// Initialize middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Serve static files
app.use('/interac', express.static(path.join(__dirname, '../public')));
app.use('/interac/client-side', express.static(path.join(__dirname, '../client-side')));

// API routes
app.use('/interac/api/auth', authRoutes);
app.use('/interac/api/quiz', quizRoutes);

// Serve the main page
app.get('/interac', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Initialize Socket.io server
initSocketServer(server);

// Start the server
const PORT = process.env.PORT || config.server.port || 8080;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = server;
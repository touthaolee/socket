// server-side/server-main.js
const express = require('express');
const http = require('http');
const path = require('path');
const cookieParser = require('cookie-parser');
const { initSocketServer } = require('./server-socket/socket-events');
const config = require('../config/app-config');
const logger = require('../logger');

// Import API routes
const authRoutes = require('./server-api/api-auth');
const quizRoutes = require('./server-api/api-quiz');
const aiRoutes = require('./server-api/api-ai'); // Add this line

// Create Express app and HTTP server
const app = express();
app.set('trust proxy', 1); // Trust first proxy for correct IP handling
const server = http.createServer(app);

// Initialize middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Serve static files
app.use('/interac', express.static(path.join(__dirname, '../public')));
app.use('/interac/client-side', express.static(path.join(__dirname, '../client-side')));
app.use('/interac/client-styles', express.static(path.join(__dirname, '../client-side/client-styles'))); // Add this line

// API routes
app.use('/interac/api/auth', authRoutes);
app.use('/interac/api/quiz', quizRoutes);
app.use('/interac/api/ai', aiRoutes); // Add this line

// Serve the main page
app.get('/interac', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Centralized error handler middleware
app.use((err, req, res, next) => {
  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';
  logger.error(`Error: ${message}`);
  res.status(status).json({ error: message });
});

// Initialize Socket.io server
initSocketServer(server);

// Start the server
const PORT = process.env.PORT || config.server.port || 8080;
server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});

module.exports = server;
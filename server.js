// server.js - Development server for local testing
// This file provides a standalone development server that mimics the production setup

// Load environment variables
require('dotenv').config();

// Simply require and start the main server module
const server = require('./server-side/server-main');
const logger = require('./logger');

// Export the server instance (useful for testing)
module.exports = server;

// Note: In production, app.js is used as the entry point through Passenger
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});
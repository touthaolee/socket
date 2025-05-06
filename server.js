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
// Only start the server if this file is run directly
if (require.main === module) {
  try {
    // Get the actual app/server instance from server-main.js
    // server-main.js exports the server (http.Server)
    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
    });
  } catch (err) {
    logger.error('Failed to start server:', err);
    process.exit(1);
  }
}
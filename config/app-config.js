/**
 * Application configuration
 */
module.exports = {
  // Server configuration
  PORT: process.env.PORT || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  
  // Authentication
  JWT_SECRET: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
  JWT_EXPIRY: '24h',
  
  // Application paths
  BASE_PATH: '/interac',
  
  // Quiz settings
  DEFAULT_TIME_LIMIT: 30, // seconds per question
  
  // Socket.io settings
  SOCKET_PATH: '/interac/socket.io',
  
  // CORS settings (for development)
  CORS_ORIGIN: '*'
};
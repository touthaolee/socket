// config/app-config.js
require('dotenv').config();

// Validate essential security configuration
if (!process.env.JWT_SECRET) {
  console.error('ERROR: JWT_SECRET environment variable is not set!');
  console.error('This is a critical security configuration. The application cannot start.');
  console.error('Please set JWT_SECRET in your environment or .env file.');
  process.exit(1); // Exit with error code
}

module.exports = {
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '24h'
  },
  server: {
    port: process.env.PORT || 8080
  }
};
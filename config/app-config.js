// config/app-config.js
require('dotenv').config();

module.exports = {
  jwt: {
    secret: process.env.JWT_SECRET || 'fallback_secret_key_for_development',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h'
  },
  server: {
    port: process.env.PORT || 8080
  }
};
// config/app-config.js
require('dotenv').config();

// Validate essential security configuration
if (!process.env.JWT_SECRET) {
  console.error('ERROR: JWT_SECRET environment variable is not set!');
  console.error('This is a critical security configuration. The application cannot start.');
  console.error('Please set JWT_SECRET in your environment or .env file.');
  process.exit(1); // Exit with error code
}

// Validate AI configuration
if (!process.env.GEMINI_API_KEY) {
  console.warn('WARNING: GEMINI_API_KEY environment variable is not set!');
  console.warn('AI features will not work correctly without a valid Gemini API key.');
  console.warn('Please set GEMINI_API_KEY in your environment or .env file.');
}

module.exports = {
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '24h'
  },
  server: {
    port: process.env.PORT || 8080
  },
  ai: {
    geminiApiKey: process.env.GEMINI_API_KEY,
    enabled: !!process.env.GEMINI_API_KEY
  }
};
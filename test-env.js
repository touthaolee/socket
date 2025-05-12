// Test environment variable loading
require('dotenv').config();
console.log('JWT_SECRET:', process.env.JWT_SECRET);
console.log('GEMINI_API_KEY:', process.env.GEMINI_API_KEY);

// server-side/server-api/api-auth.js
const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const authService = require('../server-services/auth-service');

// Rate limiting to prevent brute force attacks
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per IP
  message: { error: 'Too many login attempts, please try again later' }
});

// Register route
router.post('/register', async (req, res) => {
  try {
    const { username, password, email } = req.body;
    
    // Validate input
    if (!username || !password || !email) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    
    // Create user
    const user = await authService.createUser({
      username,
      password,
      email
    });
    
    // Generate JWT token
    const token = authService.generateToken(user);
    
    res.status(201).json({ 
      token, 
      user: { 
        id: user.id, 
        username: user.username, 
        email: user.email 
      } 
    });
  } catch (error) {
    console.error('Registration error:', error);
    if (error.message === 'Username already exists') {
      return res.status(409).json({ error: 'Username already exists' });
    }
    res.status(500).json({ error: 'Server error during registration' });
  }
});

// Login route
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Validate input
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    
    // Find user
    const user = await authService.findUserByUsername(username);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Check password
    const isPasswordValid = await authService.verifyPassword(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Generate JWT token
    const token = authService.generateToken(user);
    
    res.json({ 
      token, 
      user: { 
        id: user.id, 
        username: user.username, 
        email: user.email 
      } 
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error during login' });
  }
});

module.exports = router;
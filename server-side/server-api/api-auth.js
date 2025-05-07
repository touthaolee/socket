// server-side/server-api/api-auth.js
const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { authService } = require('../service-registry');
const authMiddleware = require('../middleware/auth-middleware');

// Rate limiting to prevent brute force attacks
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Increased to 10 attempts
  message: { error: 'Too many login attempts, please try again later' }
});

// Register route
router.post('/register', loginLimiter, async (req, res) => {
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
    console.log(`Login attempt for user: ${username}`);
    const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
    
    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }
    
    // Check if username is already active (for regular users only, not admin)
    if (username !== ADMIN_USERNAME) {
      const socketHandlers = require('../server-socket/socket-handlers');
      
      // Check if username is already in use by an active user
      if (socketHandlers.isUsernameActive(username)) {
        return res.status(409).json({ 
          error: 'Username already in use', 
          message: 'This username is already logged in. Please choose a different username or try again later.'
        });
      }
    }
    
    // Admin login always requires password
    if (username === ADMIN_USERNAME) {
      if (!password) {
        return res.status(400).json({ error: 'Password is required for admin login' });
      }
      if (password === ADMIN_PASSWORD) {
        const adminUser = { id: 1, username: ADMIN_USERNAME, role: 'admin' };
        const token = authService.generateToken(adminUser);
        return res.json({ token, user: adminUser });
      } else {
        return res.status(401).json({ error: 'Invalid admin credentials' });
      }
    }
    
    // For non-admin users, allow username-only login
    let user = await authService.findUserByUsername(username);
    if (!user) {
      // Optionally auto-register the user if not found
      user = await authService.createUser({ username, password: '', email: null });
    }
    
    // If password is provided, verify it (for legacy users)
    if (password && user.password) {
      const isPasswordValid = await authService.verifyPassword(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
    }
    
    // Issue JWT for the user
    const token = authService.generateToken(user);
    res.json({ token, user: { id: user.id, username: user.username, role: user.role || 'user' } });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// Token verification endpoint
router.get('/verify', async (req, res) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    // Verify token
    const decoded = authService.verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    // For admin users from the special case, we don't need to check in the database
    if (decoded.username === 'admin' && decoded.role === 'admin') {
      return res.json({
        valid: true,
        user: {
          id: decoded.id,
          username: decoded.username,
          role: decoded.role
        }
      });
    }
    
    // Get user from database to ensure they still exist
    const user = await authService.findUserById(decoded.id);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    // Return success with user info
    res.json({ 
      valid: true, 
      user: { 
        id: user.id, 
        username: user.username, 
        role: user.role || 'user' 
      } 
    });
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(500).json({ error: 'Server error during token verification' });
  }
});

// Add a new endpoint to check username availability
router.get('/check-username/:username', async (req, res) => {
  try {
    const { username } = req.params;
    
    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }
    
    // Get the socket handlers to check if username is active
    const socketHandlers = require('../server-socket/socket-handlers');
    
    // Check if username is already in use by an active user
    const isAvailable = !socketHandlers.isUsernameActive(username);
    
    res.json({ available: isAvailable });
  } catch (error) {
    console.error('Username check error:', error);
    res.status(500).json({ error: 'Server error checking username' });
  }
});

// Add an endpoint to clear offline users
router.post('/clear-offline-users', async (req, res) => {
    try {
        const socketHandlers = require('../server-socket/socket-handlers');
        const removedCount = socketHandlers.clearOfflineUsers();
        
        console.log(`API request: Cleared ${removedCount} offline users`);
        
        return res.status(200).json({
            success: true,
            message: `Successfully cleared ${removedCount} offline users`,
            count: removedCount
        });
    } catch (error) {
        console.error('Error clearing offline users:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to clear offline users',
            error: error.message
        });
    }
});

module.exports = router;
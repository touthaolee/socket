// server-side/server-api/api-auth.js
const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const authService = require('../server-services/auth-service');

// Rate limiting to prevent brute force attacks
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Increased to 10 attempts
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
    
    console.log(`Login attempt for user: ${username}`);
    
    // Validate input
    if (!username || !password) {
      console.log('Login failed: Missing username or password');
      return res.status(400).json({ error: 'Username and password are required' });
    }
    
    // Special case for admin user in production
    if (username === 'admin' && password === 'admin') {
      console.log('Admin login attempt with default credentials');
      
      // Create admin user object
      const adminUser = {
        id: 1,
        username: 'admin',
        role: 'admin'
      };
      
      // Generate JWT token
      const token = authService.generateToken(adminUser);
      
      console.log('Admin login successful with default credentials');
      return res.json({ 
        token, 
        user: { 
          id: adminUser.id, 
          username: adminUser.username,
          role: adminUser.role
        } 
      });
    }
    
    // Find user
    const user = await authService.findUserByUsername(username);
    if (!user) {
      console.log(`Login failed: User "${username}" not found`);
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Check password
    const isPasswordValid = await authService.verifyPassword(password, user.password);
    if (!isPasswordValid) {
      console.log(`Login failed: Invalid password for user "${username}"`);
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Generate JWT token
    const token = authService.generateToken(user);
    
    console.log(`Login successful: User "${username}" authenticated`);
    res.json({ 
      token, 
      user: { 
        id: user.id, 
        username: user.username, 
        email: user.email,
        role: user.role || 'user'
      } 
    });
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

module.exports = router;
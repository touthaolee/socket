// server-side/server-services/auth-service.js
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../../config/app-config');
const fileUtils = require('./file-utils');
const { logger } = require('../../logger');
const crypto = require('crypto');

// Path to the users data file
const DB_FILE = path.join(__dirname, '../../data/users.json');
// Path to token blacklist file
const BLACKLIST_FILE = path.join(__dirname, '../../data/token-blacklist.json');

// Ensure the data directory exists
const dataDir = path.dirname(DB_FILE);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize token blacklist if not exists
if (!fs.existsSync(BLACKLIST_FILE)) {
  fileUtils.atomicWriteFileSync(BLACKLIST_FILE, JSON.stringify({
    tokens: [],
    // Auto-cleanup by storing expiration timestamps
    expirations: {}
  }, null, 2));
}

// On startup, ensure at least one admin user exists in users.json
function ensureAdminUser() {
  let data;
  if (!fs.existsSync(DB_FILE)) {
    data = { users: [], nextId: 1 };
  } else {
    data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    if (Array.isArray(data)) {
      data = { users: data, nextId: 1 };
    }
  }
  const hasAdmin = data.users && data.users.some(u => u.role === 'admin');
  if (!hasAdmin) {
    // Generate a secure random password
    const adminPassword = crypto.randomBytes(8).toString('base64');
    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync(adminPassword, salt);
    const adminUser = {
      id: 1,
      username: 'admin',
      password: hashedPassword,
      role: 'admin',
      createdAt: new Date().toISOString()
    };
    data.users.push(adminUser);
    data.nextId = 2;
    fileUtils.atomicWriteFileSync(DB_FILE, JSON.stringify(data, null, 2));
    console.log('\x1b[33m%s\x1b[0m', `Default admin user created. Username: admin  Password: ${adminPassword}`);
    logger.warn(`Default admin user created. Username: admin  Password: ${adminPassword}`);
  }
}
ensureAdminUser();

// Debug helper to log user data format
function logUserDataFormat() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf8');
      console.log('User data file found. Format check:');
      const parsed = JSON.parse(data);
      console.log('Data type:', Array.isArray(parsed) ? 'Array' : 'Object');
      console.log('First entry:', typeof parsed === 'object' ? 
        (Array.isArray(parsed) ? JSON.stringify(parsed[0]) : JSON.stringify(parsed.users?.[0])) 
        : 'Not an object or array');
    } else {
      console.log('User data file not found');
    }
  } catch (error) {
    console.error('Error logging user data format:', error);
  }
}

// Log the format on startup
logUserDataFormat();

// Auto-cleanup for the token blacklist (runs every hour)
setInterval(() => {
  try {
    cleanupBlacklistedTokens();
  } catch (error) {
    logger.error('Error during blacklist cleanup:', error);
  }
}, 60 * 60 * 1000); // Every hour

const authService = {
  // Find user by username
  async findUserByUsername(username) {
    try {
      // Read the users data file
      const rawData = fs.readFileSync(DB_FILE, 'utf8');
      let data = JSON.parse(rawData);
      
      // Handle both formats - array of users or {users: []}
      const users = Array.isArray(data) ? data : (data.users || []);
      
      // Debug
      console.log(`Looking for user ${username} in ${users.length} users`);
      
      return users.find(user => user.username === username);
    } catch (error) {
      console.error('Error finding user:', error);
      return null;
    }
  },
  
  // Find user by ID
  async findUserById(id) {
    try {
      // Read the users data file
      const rawData = fs.readFileSync(DB_FILE, 'utf8');
      let data = JSON.parse(rawData);
      
      // Handle both formats - array of users or {users: []}
      const users = Array.isArray(data) ? data : (data.users || []);
      
      return users.find(user => user.id === id);
    } catch (error) {
      console.error('Error finding user by ID:', error);
      return null;
    }
  },
  
  // Verify password
  async verifyPassword(plainPassword, hashedPassword) {
    try {
      return bcrypt.compare(plainPassword, hashedPassword);
    } catch (error) {
      console.error('Error verifying password:', error);
      return false;
    }
  },
  
  // Generate JWT token
  generateToken(user) {
    return jwt.sign(
      { id: user.id, username: user.username, role: user.role || 'user' },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );
  },
  
  // Verify JWT token
  verifyToken(token) {
    try {
      return jwt.verify(token, config.jwt.secret);
    } catch (error) {
      logger.warn(`Token verification error: ${error.message}`);
      return null;
    }
  },
  
  // Blacklist a token (used for logout)
  async blacklistToken(token) {
    try {
      // Get expiration from token without verifying signature
      const decoded = jwt.decode(token);
      if (!decoded || !decoded.exp) {
        throw new Error('Invalid token format');
      }
      
      // Read blacklist
      const rawData = fs.readFileSync(BLACKLIST_FILE, 'utf8');
      const blacklist = JSON.parse(rawData);
      
      // Add token to blacklist if not already there
      if (!blacklist.tokens.includes(token)) {
        blacklist.tokens.push(token);
        // Store expiration for auto-cleanup
        blacklist.expirations[token] = decoded.exp;
        
        fileUtils.atomicWriteFileSync(BLACKLIST_FILE, JSON.stringify(blacklist, null, 2));
        logger.info(`Token blacklisted for user: ${decoded.username}`);
      }
      
      return true;
    } catch (error) {
      logger.error('Error blacklisting token:', error);
      return false;
    }
  },
  
  // Check if a token is blacklisted
  async isTokenBlacklisted(token) {
    try {
      // Read blacklist
      const rawData = fs.readFileSync(BLACKLIST_FILE, 'utf8');
      const blacklist = JSON.parse(rawData);
      
      return blacklist.tokens.includes(token);
    } catch (error) {
      logger.error('Error checking blacklisted token:', error);
      // If there's an error, assume the token is not blacklisted
      return false;
    }
  },
  
  // Update user's last active timestamp
  async updateLastActive(userId) {
    try {
      const rawData = fs.readFileSync(DB_FILE, 'utf8');
      let data = JSON.parse(rawData);
      const users = Array.isArray(data) ? data : (data.users || []);
      const idx = users.findIndex(u => u.id === userId);
      
      if (idx === -1) {
        logger.warn(`Attempted to update last active for non-existent user ID: ${userId}`);
        return false;
      }
      
      users[idx].lastActive = new Date().toISOString();
      
      // Don't write to disk on every update; use a debounce mechanism
      // Only update the file if the last update was more than 5 minutes ago
      const lastUpdate = users[idx].lastUpdateTime || 0;
      const now = Date.now();
      if (now - lastUpdate > 5 * 60 * 1000) {
        users[idx].lastUpdateTime = now;
        fileUtils.atomicWriteFileSync(DB_FILE, JSON.stringify(
          Array.isArray(data) ? users : { ...data, users }, 
          null, 2
        ));
      }
      
      return true;
    } catch (error) {
      logger.error('Error updating last active timestamp:', error);
      return false;
    }
  },
  
  // Create a new user
  async createUser(userData) {
    try {
      // Read the users data file
      const rawData = fs.readFileSync(DB_FILE, 'utf8');
      let data = JSON.parse(rawData);
      
      // Handle both formats - array of users or {users: []}
      let users = Array.isArray(data) ? data : (data.users || []);
      let isArrayFormat = Array.isArray(data);
      
      // Check if username already exists
      if (users.some(user => user.username === userData.username)) {
        throw new Error('Username already exists');
      }
      
      // Hash the password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(userData.password, salt);
      
      // Create new user object
      const newUser = {
        id: isArrayFormat ? (users.length > 0 ? Math.max(...users.map(u => u.id)) + 1 : 1) : (data.nextId++),
        username: userData.username,
        password: hashedPassword,
        email: userData.email || null,
        role: userData.role || "user",
        createdAt: new Date().toISOString()
      };
      
      // Add the new user
      if (isArrayFormat) {
        users.push(newUser);
        fileUtils.atomicWriteFileSync(DB_FILE, JSON.stringify(users, null, 2));
      } else {
        data.users.push(newUser);
        fileUtils.atomicWriteFileSync(DB_FILE, JSON.stringify(data, null, 2));
      }
      
      logger.info(`New user created: ${userData.username}`);
      return newUser;
    } catch (error) {
      logger.error('Error creating user:', error);
      throw error;
    }
  },
  
  // Cleanup blacklisted tokens - remove expired ones
  async cleanupBlacklistedTokens() {
    try {
      const rawData = fs.readFileSync(BLACKLIST_FILE, 'utf8');
      const blacklist = JSON.parse(rawData);
      
      const now = Math.floor(Date.now() / 1000); // Current time in seconds
      const validTokens = [];
      const expirations = blacklist.expirations || {};
      
      // Only keep tokens that are not expired
      for (const token of blacklist.tokens) {
        if (expirations[token] && expirations[token] > now) {
          validTokens.push(token);
        }
      }
      
      // Update the blacklist file only if there are changes
      if (validTokens.length !== blacklist.tokens.length) {
        blacklist.tokens = validTokens;
        fileUtils.atomicWriteFileSync(BLACKLIST_FILE, JSON.stringify(blacklist, null, 2));
        logger.info(`Blacklisted tokens cleaned up. Remaining tokens: ${validTokens.length}`);
      }
    } catch (error) {
      logger.error('Error cleaning up blacklisted tokens:', error);
    }
  }
};

module.exports = authService;
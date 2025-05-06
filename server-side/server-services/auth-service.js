// server-side/server-services/auth-service.js
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../../config/app-config');

// Path to the users data file
const DB_FILE = path.join(__dirname, '../../data/users.json');

// Ensure the data directory exists
const dataDir = path.dirname(DB_FILE);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize users database if not exists
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify([
    {
      id: 1,
      username: "admin",
      password: "$2a$10$y5nb9DwU4t93JvI2QoU1Cu6pM8wEY5vZBztWEeQUyQK9D9Yv1bhbO",
      role: "admin"
    }
  ], null, 2));
}

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
      // Added logging for debugging
      console.log(`Verifying password: ${plainPassword.substring(0, 1)}*** against hash: ${hashedPassword.substring(0, 10)}...`);
      
      // Use a fallback for development if needed
      const adminPlainPassword = 'admin';
      const adminHashedPassword = '$2a$10$y5nb9DwU4t93JvI2QoU1Cu6pM8wEY5vZBztWEeQUyQK9D9Yv1bhbO';
      
      // Hardcoded admin check for development - remove in production
      if (plainPassword === adminPlainPassword && hashedPassword === adminHashedPassword) {
        console.log('Development mode: Admin credentials match');
        return true;
      }
      
      // Normal password verification
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
      console.error('Token verification error:', error);
      return null;
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
        fs.writeFileSync(DB_FILE, JSON.stringify(users, null, 2));
      } else {
        data.users.push(newUser);
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
      }
      
      // Return user without password
      const { password, ...userWithoutPassword } = newUser;
      return userWithoutPassword;
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }
};

module.exports = authService;
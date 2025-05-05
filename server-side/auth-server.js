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
  fs.writeFileSync(DB_FILE, JSON.stringify({ users: [], nextId: 1 }, null, 2));
}

const authService = {
  // Find user by username
  async findUserByUsername(username) {
    try {
      const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      return data.users.find(user => user.username === username);
    } catch (error) {
      console.error('Error finding user:', error);
      return null;
    }
  },
  
  // Find user by ID
  async findUserById(id) {
    try {
      const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      return data.users.find(user => user.id === id);
    } catch (error) {
      console.error('Error finding user by ID:', error);
      return null;
    }
  },
  
  // Create a new user
  async createUser(userData) {
    try {
      const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      
      // Check if username already exists
      if (data.users.some(user => user.username === userData.username)) {
        throw new Error('Username already exists');
      }
      
      // Hash the password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(userData.password, salt);
      
      const newUser = {
        id: data.nextId++,
        username: userData.username,
        password: hashedPassword,
        email: userData.email,
        createdAt: new Date().toISOString()
      };
      
      data.users.push(newUser);
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
      
      // Return user without password
      const { password, ...userWithoutPassword } = newUser;
      return userWithoutPassword;
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  },
  
  // Verify password
  async verifyPassword(plainPassword, hashedPassword) {
    return bcrypt.compare(plainPassword, hashedPassword);
  },
  
  // Generate JWT token
  generateToken(user) {
    return jwt.sign(
      { id: user.id, username: user.username },
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
  }
};

module.exports = authService;
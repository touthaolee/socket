const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const winston = require('winston');

// Create Express app and HTTP server
const app = express();
const server = http.createServer(app);

// Initialize Socket.io
const io = new Server(server, {
  path: '/interac/socket.io',
  cors: {
    origin: "*", // Allow connections from any origin (adjust for production)
    methods: ["GET", "POST"]
  }
});

// Configure Winston logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `[${timestamp}] ${level.toUpperCase()}: ${message}`;
    })
  ),
  transports: [
    new winston.transports.File({ filename: 'server.log' }),
    new winston.transports.Console()
  ]
});

// Replace console.log and console.error with logger
console.log = (...args) => logger.info(args.join(' '));
console.error = (...args) => logger.error(args.join(' '));

// Serve static files under /interac
app.use('/interac', express.static(path.join(__dirname, 'public')));
// Add this to your existing server.js
app.use('/interac/client-side', express.static(path.join(__dirname, 'client-side')));

// Serve the main page for /interac
app.get('/interac', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Track connected users
const users = {};

// Helper: broadcast user list to all clients
function broadcastUserList() {
  io.emit('user_list', Object.values(users));
}

// --- Authentication Middleware Example ---
io.use((socket, next) => {
  // Simple check: require a username in handshake query
  const username = socket.handshake.auth && socket.handshake.auth.username;
  if (!username) {
    return next(new Error('Username required'));
  }
  socket.username = username;
  next();
});

// --- Event Rate Limiting ---
const rateLimitMap = new Map();
function isRateLimited(socket, event, limit = 5, interval = 10000) {
  // Allow 'limit' events per 'interval' ms
  const now = Date.now();
  if (!rateLimitMap.has(socket.id)) rateLimitMap.set(socket.id, {});
  const userEvents = rateLimitMap.get(socket.id);
  if (!userEvents[event]) userEvents[event] = [];
  userEvents[event] = userEvents[event].filter(ts => now - ts < interval);
  if (userEvents[event].length >= limit) return true;
  userEvents[event].push(now);
  return false;
}

// --- Custom Event Logging ---
function logEvent(event, socket, data) {
  console.log(`[Event] ${event} from ${socket.id} (${socket.username}):`, data);
}

// --- Namespaces Example ---
const adminNamespace = io.of('/admin');
adminNamespace.on('connection', (socket) => {
  console.log('[Admin NS] Admin connected:', socket.id);
  socket.on('admin_message', (data) => {
    logEvent('admin_message', socket, data);
    adminNamespace.emit('admin_broadcast', { from: socket.username, message: data.message });
  });
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('New user connected:', socket.id, 'as', socket.username);

  // --- Rooms ---
  socket.on('join_room', (room) => {
    logEvent('join_room', socket, room);
    socket.join(room);
    socket.emit('room_joined', room);
    io.to(room).emit('room_announcement', `${socket.username} joined room ${room}`);
  });
  socket.on('leave_room', (room) => {
    logEvent('leave_room', socket, room);
    socket.leave(room);
    socket.emit('room_left', room);
    io.to(room).emit('room_announcement', `${socket.username} left room ${room}`);
  });
  socket.on('room_message', ({ room, message }) => {
    if (isRateLimited(socket, 'room_message')) {
      socket.emit('rate_limited', { event: 'room_message' });
      return;
    }
    logEvent('room_message', socket, { room, message });
    io.to(room).emit('room_message', { user: socket.username, message, timestamp: new Date().toISOString(), room });
  });

  // --- Broadcasting ---
  socket.on('broadcast_message', (data) => {
    logEvent('broadcast_message', socket, data);
    socket.broadcast.emit('broadcast_message', { from: socket.username, message: data.message });
  });

  // Modern Socket.IO test: respond to test_event
  socket.on('test_event', (data) => {
    console.log('[Test] Received test_event from', socket.id, data);
    socket.emit('test_response', { status: 'ok', received: data, serverTime: new Date().toISOString() });
  });

  // Custom ping-pong for stability
  socket.on('custom_ping', (data) => {
    console.log('[Ping] Received custom_ping from', socket.id, data);
    socket.emit('custom_pong', { serverTime: new Date().toISOString() });
  });

  // Acknowledgement test handler
  socket.on('ack_test', (data, callback) => {
    console.log('[Ack Test] Received ack_test from', socket.id, data);
    callback({ status: 'acknowledged', received: data, serverTime: new Date().toISOString() });
  });

  // Handle user joining
  socket.on('user_join', (username) => {
    users[socket.id] = username;
    console.log(`${username} joined the chat`);
    broadcastUserList();
  });
  
  // Handle chat messages
  socket.on('chat_message', (data) => {
    console.log(`Message from ${users[socket.id]}: ${data.message}`);
    
    // Broadcast the message to all clients
    io.emit('chat_message', {
      user: users[socket.id],
      message: data.message,
      timestamp: new Date().toISOString()
    });
  });
  
  // Handle typing indicator
  socket.on('typing', () => {
    socket.broadcast.emit('user_typing', users[socket.id]);
  });
  
  // Handle user disconnection
  socket.on('disconnect', () => {
    const username = users[socket.id];
    if (username) {
      console.log(`${username} disconnected`);
      delete users[socket.id];
      broadcastUserList();
    }
  });
});

// Start the server
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Socket.io server running on port ${PORT}`);
  // Add this to your existing server.js file

// Import required modules
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const cookieParser = require('cookie-parser');
const authRoutes = require('./server-side/server-api/api-auth');
const authService = require('./server-side/server-services/auth-service');

// Create Express app and HTTP server
const app = express();
const server = http.createServer(app);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// API routes
app.use('/interac/api/auth', authRoutes);

// Initialize Socket.io
const io = new Server(server, {
  path: '/interac/socket.io',
  cors: {
    origin: "*", // Allow connections from any origin (adjust for production)
    methods: ["GET", "POST"]
  }
});

// Socket.io JWT Authentication Middleware
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error('Authentication token required'));
    }
    
    // Verify token
    const decoded = authService.verifyToken(token);
    if (!decoded) {
      return next(new Error('Invalid authentication token'));
    }
    
    // Find user
    const user = await authService.findUserById(decoded.id);
    if (!user) {
      return next(new Error('User not found'));
    }
    
    // Store user data in socket
    socket.user = {
      id: user.id,
      username: user.username
    };
    
    next();
  } catch (error) {
    console.error('Socket authentication error:', error);
    next(new Error('Authentication error'));
  }
});

// Socket.io event handlers
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.user.username} (${socket.id})`);
  
  // Handle user joining
  socket.on('user_join', () => {
    console.log(`${socket.user.username} joined the chat`);
    io.emit('user_list', getActiveUsers());
  });
  
  // Handle chat messages
  socket.on('chat_message', (data) => {
    io.emit('chat_message', {
      user: socket.user.username,
      message: data.message,
      timestamp: new Date().toISOString()
    });
  });
  
  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`${socket.user.username} disconnected`);
    io.emit('user_list', getActiveUsers());
  });
});

// Helper function to get active users
function getActiveUsers() {
  const users = [];
  for (const [id, socket] of io.sockets.sockets) {
    users.push({
      id: socket.user.id,
      username: socket.user.username
    });
  }
  return users;
}

// Start the server
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
});
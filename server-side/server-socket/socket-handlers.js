// Update server-side/server-socket/socket-handlers.js

const jwt = require('jsonwebtoken');
const config = require('../../config/app-config');

// Add/update presence tracking data structures
const activeUsers = new Map(); // Map<userId, {username, lastActivity, socketIds: Set<socketId}>
const inactivityTimeout = 30000; // 30 seconds
const disconnectionGracePeriod = 5000; // 5 seconds
let presenceCleanupInterval;

function registerQuizHandlers(io, socket) {
    const backgroundProcessingService = require('../server-services/background-processing-service');
    const logger = require('../../logger');
    // Set up quiz generation progress handling
    const progressEmitter = backgroundProcessingService.getProgressEmitter();

    // Forward progress updates to admin clients
    progressEmitter.on('progress', (progressData) => {
        // Find admin sockets
        const adminSockets = Array.from(io.sockets.sockets.values())
            .filter(s => s.user && s.user.role === 'admin');
        // Send updates to admin clients
        adminSockets.forEach(adminSocket => {
            adminSocket.emit('quiz:generation:progress', progressData);
        });
    });

    // Start quiz generation
    socket.on('quiz:generate', async (data) => {
        // Only allow admins
        if (!socket.user || socket.user.role !== 'admin') {
            socket.emit('error', { message: 'Not authorized to generate quizzes' });
            return;
        }
        try {
            const { quizId, config } = data;
            if (!quizId) {
                socket.emit('error', { message: 'Quiz ID is required' });
                return;
            }
            const jobId = backgroundProcessingService.startQuizGeneration(quizId, config || {});
            socket.emit('quiz:generation:started', { jobId, quizId });
        } catch (error) {
            logger.error('Error starting quiz generation:', error);
            socket.emit('error', { message: 'Failed to start quiz generation' });
        }
    });

    // Get generation progress
    socket.on('quiz:generation:status', (data) => {
        const { jobId } = data;
        if (!jobId) {
            socket.emit('error', { message: 'Job ID is required' });
            return;
        }
        const progress = backgroundProcessingService.getJobProgress(jobId);
        if (progress) {
            socket.emit('quiz:generation:progress', progress);
        } else {
            socket.emit('quiz:generation:not_found', { jobId });
        }
    });
}

function registerChatHandlers(io, socket) {
    const logger = require('../../logger');
    
    // Handle incoming chat messages
    socket.on('chat_message', (data) => {
        if (!socket.user) {
            socket.emit('error', { message: 'Authentication required for chat' });
            return;
        }
        
        // Validate message
        if (!data.message || typeof data.message !== 'string') {
            socket.emit('error', { message: 'Invalid message format' });
            return;
        }
        
        // Rate limiting could be added here
        
        // Format the message for broadcasting
        const messageToSend = {
            from: socket.user.username,
            userId: socket.user.id,
            message: data.message.substring(0, 500), // Limit message length
            timestamp: data.timestamp || new Date().toISOString()
        };
        
        logger.info('Chat message received', {
            from: socket.user.username,
            messageLength: data.message.length
        });
        
        // Broadcast to all clients
        io.emit('chat_message', messageToSend);
    });
    
    // Notify others when a user joins chat
    if (socket.user) {
        socket.broadcast.emit('chat_message', {
            system: true,
            message: `${socket.user.username} has joined the chat`,
            timestamp: new Date().toISOString()
        });
    }
    
    // Setup disconnect handler to notify on leave
    socket.on('disconnect', () => {
        if (socket.user) {
            socket.broadcast.emit('chat_message', {
                system: true,
                message: `${socket.user.username} has left the chat`,
                timestamp: new Date().toISOString()
            });
        }
    });
}

function setupAuthMiddleware(io, options = {}) {
    const logger = require('../../logger');
    const rateLimit = {};
    const MAX_ATTEMPTS = 5;
    const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
    const allowedRoles = options.allowedRoles || null; // e.g., ['admin', 'user']

    io.use(async (socket, next) => {
        try {
            const ip = socket.handshake.address;
            // Rate limiting (per IP)
            if (!rateLimit[ip]) rateLimit[ip] = { count: 0, first: Date.now() };
            const rl = rateLimit[ip];
            if (Date.now() - rl.first > WINDOW_MS) {
                rl.count = 0;
                rl.first = Date.now();
            }
            if (rl.count >= MAX_ATTEMPTS) {
                logger.warn('Rate limit exceeded for IP', ip);
                return next(new Error('Too many authentication attempts. Try again later.'));
            }

            logger.info('Socket handshake received', {
                ip,
                auth: socket.handshake.auth,
                query: socket.handshake.query
            });

            const token = socket.handshake.auth?.token || socket.handshake.query?.token;
            const username = socket.handshake.auth?.username || socket.handshake.query?.username;
            
            if (!token) {
                // Allow guest/test connections with just a username
                if (username) {
                    // Check if the username is already active
                    if (isUsernameActive(username)) {
                        logger.warn('Username already active', username, ip);
                        return next(new Error('Username already in use. Please choose a different username.'));
                    }
                    
                    socket.user = {
                        id: `guest_${Date.now()}_${Math.floor(Math.random()*10000)}`,
                        username,
                        role: 'guest',
                        guest: true
                    };
                    logger.info('Guest/username-only connection allowed', ip, username);
                    return next();
                } else {
                    rl.count++;
                    logger.warn('Authentication token missing', ip, socket.handshake.auth);
                    return next(new Error('Authentication token missing'));
                }
            }
            
            // Process token-based authentication
            let decoded;
            try {
                decoded = await new Promise((resolve, reject) => {
                    require('jsonwebtoken').verify(token, require('../../config/app-config').jwt.secret, (err, decoded) => {
                        if (err) reject(err);
                        else resolve(decoded);
                    });
                });
                
                // Check if the username from the token is already active (but not by this user's ID)
                // This prevents someone else from using a registered user's username
                if (decoded.username && isUsernameActive(decoded.username)) {
                    // Check if it's not the same user with a different connection
                    const activeUsers = Array.from(global.activeUsers?.values() || []);
                    const sameUserDifferentConnection = activeUsers.some(user => 
                        user.username.toLowerCase() === decoded.username.toLowerCase() && 
                        user.userId === decoded.id
                    );
                    
                    if (!sameUserDifferentConnection) {
                        logger.warn('Username from token already active', decoded.username, ip);
                        return next(new Error('This account is already logged in elsewhere.'));
                    }
                }
                
            } catch (err) {
                rl.count++;
                logger.warn('Invalid authentication token', ip, err.message, token);
                return next(new Error('Invalid authentication token: ' + err.message));
            }
            
            if (allowedRoles && !allowedRoles.includes(decoded.role)) {
                logger.warn('User role not permitted', ip, decoded.role);
                return next(new Error('User role not permitted'));
            }
            
            socket.user = decoded;
            rl.count = 0; // Reset on success
            logger.info('Authentication successful', ip, decoded.username || decoded.id || '');
            next();
        } catch (err) {
            logger.error('Unexpected error in auth middleware', err.message, err.stack);
            next(new Error('Internal authentication error: ' + err.message));
        }
    });
}

// Handle user disconnect
function handleDisconnect(io, socket) {
    const logger = require('../../logger');
    if (socket.user) {
        logger.info('User disconnected', {
            username: socket.user.username,
            id: socket.user.id,
            socketId: socket.id
        });
    } else {
        logger.info('Socket disconnected', {
            socketId: socket.id
        });
    }
    
    // Any cleanup for rooms the user was in
    if (socket.rooms) {
        // Leave all rooms
        Array.from(socket.rooms)
            .filter(room => room !== socket.id) // Socket.IO adds the socket ID as a room
            .forEach(room => {
                socket.to(room).emit('room_announcement', 
                    `${socket.user?.username || 'A user'} has left the room.`);
            });
    }
}

/**
 * Handle user presence and activity tracking
 * This ensures accurate online user lists and handles multiple connections from same user
 */
function registerPresenceHandlers(io, socket) {
    const logger = require('../../logger');
    
    if (!socket.user) return;
    
    const userId = socket.user.id || `guest_${socket.user.username}`;
    const username = socket.user.username;
    
    // Update or add user to active users
    if (activeUsers.has(userId)) {
        // User already exists, just add this socket ID
        const userData = activeUsers.get(userId);
        userData.lastActivity = Date.now();
        userData.socketIds.add(socket.id);
        userData.username = username; // In case username changed
        
        // If user was previously marked offline or inactive, notify others of return
        if (userData.status === 'offline' || userData.status === 'inactive' || userData.status === 'disconnecting') {
            userData.status = 'online';
            io.emit('user_reconnected', { username: username });
            logger.info(`User reconnected: ${username}`);
        }
    } else {
        // New user
        activeUsers.set(userId, {
            username,
            lastActivity: Date.now(),
            socketIds: new Set([socket.id]),
            status: 'online'
        });
    }

    // Emit updated user list to all clients
    broadcastUserList(io);
    
    // Handle explicit user logout event
    socket.on('user_logout', (data) => {
        logger.info(`User logout event received for: ${data.username || username}`);
        
        if (activeUsers.has(userId)) {
            const userData = activeUsers.get(userId);
            
            // Remove this socket ID
            userData.socketIds.delete(socket.id);
            
            // Mark as offline immediately without grace period since this is explicit logout
            userData.status = 'offline';
            
            // Notify other users that this user logged out
            socket.broadcast.emit('user_disconnected', { username: data.username || username });
            
            // Update the user list for all clients
            broadcastUserList(io);
            
            // Remove user from active list after a short delay (no need for the full minute)
            setTimeout(() => {
                if (activeUsers.has(userId) && 
                    activeUsers.get(userId).socketIds.size === 0 &&
                    activeUsers.get(userId).status === 'offline') {
                    activeUsers.delete(userId);
                    broadcastUserList(io);
                    logger.info(`User removed from active list after logout: ${username}`);
                }
            }, 5000); // Remove after 5 seconds
        }
    });
    
    // Handle explicit presence updates from client
    socket.on('user:presence', (data) => {
        if (activeUsers.has(userId)) {
            const userData = activeUsers.get(userId);
            userData.lastActivity = Date.now();
            
            // Update status if provided
            if (data && data.status) {
                userData.status = data.status;
                broadcastUserList(io);
            }
        }
    });
    
    // Setup heartbeat to verify active status
    socket.on('user:heartbeat', () => {
        if (activeUsers.has(userId)) {
            const userData = activeUsers.get(userId);
            userData.lastActivity = Date.now();
            
            // If user was previously marked inactive, update their status
            if (userData.status !== 'online') {
                userData.status = 'online';
                broadcastUserList(io); // Broadcast updated status
            }
        }
    });
    
    // Handle typing indicators
    socket.on('user_typing', (data) => {
        if (!data || !data.username) return;
        
        // Update activity timestamp
        if (activeUsers.has(userId)) {
            activeUsers.get(userId).lastActivity = Date.now();
        }
        
        // Broadcast typing status to all clients except sender
        socket.broadcast.emit('user_typing', { username: data.username });
    });
    
    socket.on('user_stop_typing', (data) => {
        if (!data || !data.username) return;
        socket.broadcast.emit('user_stop_typing', { username: data.username });
    });
    
    // Handle activity events to update last activity time
    const activityEvents = ['chat_message', 'join_room', 'leave_room', 'room_message', 'test_event'];
    activityEvents.forEach(event => {
        const originalHandlers = socket.listeners(event);
        
        socket.removeAllListeners(event); // Remove any existing handlers
        
        // Add new handler that updates activity time then calls original handlers
        socket.on(event, (...args) => {
            if (activeUsers.has(userId)) {
                const userData = activeUsers.get(userId);
                userData.lastActivity = Date.now();
                userData.status = 'online';
            }
            
            // Call original handlers if they exist
            if (originalHandlers && originalHandlers.length) {
                originalHandlers.forEach(handler => {
                    handler.apply(socket, args);
                });
            }
        });
    });
    
    // Handle disconnect
    socket.on('disconnect', (reason) => {
        if (activeUsers.has(userId)) {
            const userData = activeUsers.get(userId);
            
            // Remove this socket ID
            userData.socketIds.delete(socket.id);
            
            logger.info(`Socket disconnect: ${reason} for user ${username} (socket ${socket.id}). Remaining connections: ${userData.socketIds.size}`);
            
            // If no more sockets, mark as offline after grace period
            if (userData.socketIds.size === 0) {
                // Set status to disconnecting immediately
                userData.status = 'disconnecting';
                broadcastUserList(io);
                
                // Notify other users that this user disconnected
                socket.broadcast.emit('user_disconnected', { username });
                
                setTimeout(() => {
                    // Double check if user has reconnected
                    if (activeUsers.has(userId)) {
                        const userData = activeUsers.get(userId);
                        if (userData.socketIds.size === 0) {
                            userData.status = 'offline';
                            broadcastUserList(io);
                            
                            // After longer period, remove user completely
                            setTimeout(() => {
                                if (activeUsers.has(userId) && 
                                    activeUsers.get(userId).socketIds.size === 0 &&
                                    activeUsers.get(userId).status === 'offline') {
                                    activeUsers.delete(userId);
                                    broadcastUserList(io);
                                    logger.info(`User removed from active list: ${username}`);
                                }
                            }, 60000); // Remove completely after 1 minute of being offline
                        }
                    }
                }, disconnectionGracePeriod); // 5-second grace period before showing offline
            } else {
                // Still has active connections - update count
                broadcastUserList(io);
            }
        }
    });

    // Setup periodic heartbeat check if not already running
    if (!global.presenceCleanupInterval) {
        global.presenceCleanupInterval = setInterval(() => {
            const now = Date.now();
            let changed = false;
            
            activeUsers.forEach((userData, uid) => {
                // If inactive for too long, mark as inactive or remove
                if (now - userData.lastActivity > inactivityTimeout) {
                    if (userData.status === 'online') {
                        // First mark as inactive
                        userData.status = 'inactive';
                        changed = true;
                        logger.info(`Marked user as inactive: ${userData.username}`);
                    } else if (userData.status === 'inactive' && userData.socketIds.size === 0) {
                        // If already inactive and no connections, remove
                        activeUsers.delete(uid);
                        changed = true;
                        logger.info(`Removed inactive user: ${userData.username}`);
                    }
                }
            });
            
            // Only broadcast if list changed
            if (changed) {
                broadcastUserList(io);
            }
        }, 10000); // Check every 10 seconds
    }
}

/**
 * Broadcast the current user list to all connected clients
 */
function broadcastUserList(io) {
    // Create array of unique active users
    const users = Array.from(activeUsers.values()).map(userData => ({
        userId: userData.username, // Use username as ID for backward compatibility
        username: userData.username,
        connections: userData.socketIds.size,
        lastActive: userData.lastActivity,
        status: userData.status || 'online'  // Include status property
    }));

    // Broadcast to all connected clients
    io.emit('user_list', users);
}

// New function to check if a username is already active
function isUsernameActive(username) {
    // Convert both to lowercase for case-insensitive comparison
    const lowerUsername = username.toLowerCase();
    
    // Check all active users
    for (const userData of activeUsers.values()) {
        if (userData.username.toLowerCase() === lowerUsername && 
            (userData.status === 'online' || userData.status === 'inactive')) {
            return true;
        }
    }
    
    return false;
}

// New function to expose active username checking
function checkUsernameAvailability(username) {
    return !isUsernameActive(username);
}

// Add this function to manually clean up persistent offline users
function clearOfflineUsers() {
    const logger = require('../../logger');
    let removedCount = 0;
    
    // Iterate through all users in the activeUsers map
    for (const [userId, userData] of activeUsers.entries()) {
        // If the user has no socket connections and is marked as offline
        if (userData.socketIds.size === 0 || userData.status === 'offline') {
            activeUsers.delete(userId);
            removedCount++;
            logger.info(`Removed persistent offline user: ${userData.username}`);
        }
    }
    
    logger.info(`Cleaned up ${removedCount} offline users from memory`);
    return removedCount;
}

module.exports = {
    registerQuizHandlers,
    setupAuthMiddleware,
    registerChatHandlers,
    handleDisconnect,
    registerPresenceHandlers,
    isUsernameActive, // Export the username checking function
    checkUsernameAvailability,
    clearOfflineUsers // Export the cleanup function
};
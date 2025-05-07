// Update server-side/server-socket/socket-handlers.js

const jwt = require('jsonwebtoken');
const config = require('../../config/app-config');

// Add/update presence tracking data structures
const activeUsers = new Map(); // Map<userId, {username, lastActivity, socketIds: Set<socketId>, status}>
const inactivityTimeout = 30000; // 30 seconds
const disconnectionGracePeriod = 15000; // 15 seconds (increased from 10000)
let presenceCleanupInterval;

// Scheduled user cleanup tasks
function startPresenceCleanupInterval() {
    if (presenceCleanupInterval) {
        clearInterval(presenceCleanupInterval);
    }
    
    const logger = require('../../logger');
    logger.info('Starting presence cleanup interval');
    
    // Run cleanup every 15 seconds
    presenceCleanupInterval = setInterval(() => {
        const now = Date.now();
        let cleanupCount = 0;
        
        // Check for inactive and disconnected users
        for (const [userId, userData] of activeUsers.entries()) {
            // Check for extended inactivity
            if (now - userData.lastActivity > inactivityTimeout) {
                // If user has no sockets, remove entirely
                if (userData.socketIds.size === 0) {
                    // But only if they've been in this state beyond the grace period
                    if (userData.status === 'disconnecting' && 
                        userData.disconnectTime && 
                        now - userData.disconnectTime > disconnectionGracePeriod) {
                        
                        activeUsers.delete(userId);
                        cleanupCount++;
                        logger.info(`Removed inactive user with no sockets after grace period: ${userData.username} (${userId})`);
                    }
                } else {
                    // Otherwise just mark as inactive
                    if (userData.status !== 'inactive') {
                        userData.status = 'inactive';
                        logger.info(`Marked user as inactive: ${userData.username} (${userId})`);
                    }
                }
            }
        }
        
        // Broadcast updated user list if changes were made
        if (cleanupCount > 0) {
            logger.info(`Cleaned up ${cleanupCount} inactive users`);
            broadcastUserList(require('../server-main').getIO());
        }
    }, 15000);
}

// Ensure activeUsers is cleared on module initialization
// This ensures no lingering users after server restart
function clearAllUsers() {
    const logger = require('../../logger');
    const userCount = activeUsers.size;
    activeUsers.clear();
    logger.info(`Cleared all ${userCount} users on server initialization`);
    
    // Start the cleanup interval when server starts
    startPresenceCleanupInterval();
    
    return userCount;
}

// Clear all users on module initialization
clearAllUsers();

// New helper function to check if a username is active
function isUsernameActive(username) {
    if (!username) return false;
    
    for (const userData of activeUsers.values()) {
        if (userData.username.toLowerCase() === username.toLowerCase() && 
            userData.status !== 'offline' && 
            userData.status !== 'disconnecting') {
            return true;
        }
    }
    return false;
}

// New helper function to match username with userId
function hasMatchingUserIdForUsername(username, userId) {
    if (!username || !userId) return false;
    
    for (const [activeId, userData] of activeUsers.entries()) {
        if (userData.username.toLowerCase() === username.toLowerCase() && 
            activeId === userId) {
            return true;
        }
    }
    return false;
}

// Helper function to forcibly remove a user by username
function forceRemoveUserByUsername(username) {
    if (!username) return false;
    
    const logger = require('../../logger');
    let removed = false;
    
    for (const [userId, userData] of activeUsers.entries()) {
        if (userData.username.toLowerCase() === username.toLowerCase()) {
            // Get socket IDs before removal for potential force disconnects
            const socketIds = Array.from(userData.socketIds);
            
            activeUsers.delete(userId);
            logger.info(`[FORCE REMOVE] Removed user session by username: ${username} (userId: ${userId})`);
            removed = true;
            
            // Return information about the removed user for potential additional actions
            return {
                removed: true,
                userId,
                username: userData.username,
                socketIds
            };
        }
    }
    
    return { removed: false };
}

// Helper function to forcibly remove a user by userId
function forceRemoveUserById(userId) {
    if (!userId) return false;
    
    const logger = require('../../logger');
    if (activeUsers.has(userId)) {
        const userData = activeUsers.get(userId);
        // Get socket IDs before removal for potential force disconnects
        const socketIds = Array.from(userData.socketIds);
        
        activeUsers.delete(userId);
        logger.info(`[FORCE REMOVE] Removed user session by userId: ${userId} (username: ${userData.username})`);
        
        // Return information about the removed user for potential additional actions
        return {
            removed: true,
            userId,
            username: userData.username,
            socketIds
        };
    }
    
    return { removed: false };
}

// Broadcast the active user list to all clients
function broadcastUserList(io) {
    if (!io) return;
    
    // Prepare user list with minimal data
    const userList = Array.from(activeUsers.entries())
        .filter(([_, userData]) => userData.status !== 'offline' && userData.status !== 'disconnecting')
        .map(([userId, userData]) => ({
            userId,
            username: userData.username,
            status: userData.status || 'online',
            socketCount: userData.socketIds.size,
            lastActive: userData.lastActivity
        }));
    
    // Broadcast to all connected clients
    io.emit('user_list', userList);
}

// Handle user disconnect - Enhanced version that replaces duplicate implementations
function handleDisconnect(io, socket) {
    const logger = require('../../logger');
    if (socket.user) {
        logger.info('User disconnected', {
            username: socket.user.username,
            id: socket.user.id,
            socketId: socket.id,
            timestamp: new Date().toISOString()
        });
    } else {
        logger.info('Socket disconnected', {
            socketId: socket.id,
            timestamp: new Date().toISOString()
        });
    }
    
    // Handle room leave notifications
    if (socket.rooms) {
        // Leave all rooms
        Array.from(socket.rooms)
            .filter(room => room !== socket.id) // Socket.IO adds the socket ID as a room
            .forEach(room => {
                socket.to(room).emit('room_announcement', {
                    message: `${socket.user?.username || 'A user'} has left the room.`,
                    username: socket.user?.username || 'Anonymous',
                    type: 'leave',
                    timestamp: new Date().toISOString()
                });
            });
    }
    
    // Handle user presence tracking
    if (socket.user) {
        const userId = socket.user.id;
        
        if (activeUsers.has(userId)) {
            const userData = activeUsers.get(userId);
            
            // Remove this socket ID from the user's active sockets
            userData.socketIds.delete(socket.id);
            
            // If no more sockets, mark the user as disconnecting with a timestamp
            if (userData.socketIds.size === 0) {
                userData.status = 'disconnecting';
                userData.disconnectTime = Date.now();
                logger.info(`User marked as disconnecting: ${userData.username} (${userId}), will remove after ${disconnectionGracePeriod}ms if no reconnect`);
                
                // Keep the user in active list for a grace period to allow for reconnections
                // The cleanup interval will remove them if they don't reconnect
                
                // Schedule a specific cleanup for this user after grace period
                setTimeout(() => {
                    // Check if user is still in disconnecting state and has no sockets
                    if (activeUsers.has(userId) && 
                        activeUsers.get(userId).status === 'disconnecting' && 
                        activeUsers.get(userId).socketIds.size === 0) {
                        
                        logger.info(`Auto-removing disconnected user after grace period: ${userData.username} (${userId})`);
                        activeUsers.delete(userId);
                        
                        // Broadcast updated user list to all clients
                        broadcastUserList(io);
                    }
                }, disconnectionGracePeriod);
            }
            
            // Broadcast updated user list to all clients
            broadcastUserList(io);
        }
    }
    
    // Handle chat leave notifications (no duplicate implementation needed as we've consolidated)
    if (socket.user) {
        socket.broadcast.emit('chat_message', {
            system: true,
            message: `${socket.user.username} has left the chat`,
            username: "System",
            userId: "system",
            roomId: 'global',
            timestamp: new Date().toISOString()
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
            io.emit('user_reconnected', { 
                username: username,
                userId: userId,
                timestamp: new Date().toISOString()
            });
            logger.info(`User reconnected: ${username} (${userId})`);
        }
    } else {
        // New user
        activeUsers.set(userId, {
            username,
            lastActivity: Date.now(),
            socketIds: new Set([socket.id]),
            status: 'online',
            connectionTime: Date.now()
        });
    }

    // Emit updated user list to all clients
    broadcastUserList(io);
    
    // Handle explicit user logout event
    socket.on('user_logout', (data) => {
        logger.info(`User logout event received for: ${data?.username || username || 'unknown'}`, {
            userId,
            timestamp: new Date().toISOString(),
            forceRemove: !!data?.forceRemove
        });
        
        // Handle force removal flag for more complete cleanup
        if (data && data.forceRemove) {
            // Try by userId first
            let removedResult = { removed: false };
            if (data.userId) {
                removedResult = forceRemoveUserById(data.userId);
            }
            
            // If not removed by ID but username provided, try by username as fallback
            if (!removedResult.removed && data.username) {
                removedResult = forceRemoveUserByUsername(data.username);
            }
            
            // If still not removed, try using the socket's user info
            if (!removedResult.removed && socket.user) {
                if (activeUsers.has(userId)) {
                    const userData = activeUsers.get(userId);
                    const socketIds = Array.from(userData.socketIds);
                    activeUsers.delete(userId);
                    removedResult = {
                        removed: true,
                        userId,
                        username: userData.username,
                        socketIds
                    };
                    logger.info(`User force removed from active list on logout: ${username} (${userId})`);
                }
            }
            
            // Force disconnect all related sockets if found
            if (removedResult.removed && removedResult.socketIds && removedResult.socketIds.length > 0) {
                const io = require('../server-main').getIO();
                removedResult.socketIds.forEach(socketId => {
                    const targetSocket = io.sockets.sockets.get(socketId);
                    if (targetSocket) {
                        logger.info(`Force disconnecting socket ${socketId} for user ${removedResult.username}`);
                        targetSocket.disconnect(true);
                    }
                });
            }
            
            // Send acknowledgment to client
            socket.emit('user_logout_ack', { 
                success: removedResult.removed, 
                message: removedResult.removed ? 'User completely removed from active users list' : 'User not found for force removal',
                timestamp: new Date().toISOString()
            });
            
            // Force socket disconnect after acknowledgment
            setTimeout(() => {
                socket.disconnect(true);
            }, 500);
            
            // Broadcast updated user list after forced removal
            broadcastUserList(io);
        } else if (activeUsers.has(userId)) {
            const userData = activeUsers.get(userId);
            userData.socketIds.delete(socket.id);
            
            // If no more sockets, mark for removal
            if (userData.socketIds.size === 0) {
                userData.status = 'offline';
                userData.logoutTime = Date.now();
                
                // Send acknowledgment to client
                socket.emit('user_logout_ack', { 
                    success: true, 
                    message: 'User marked as offline',
                    timestamp: new Date().toISOString()
                });
                
                // Schedule user to be completely removed after grace period
                setTimeout(() => {
                    // Only remove if still offline and has no sockets
                    if (activeUsers.has(userId) && 
                        activeUsers.get(userId).status === 'offline' && 
                        activeUsers.get(userId).socketIds.size === 0) {
                        
                        activeUsers.delete(userId);
                        logger.info(`Auto-removing logged out user after grace period: ${username} (${userId})`);
                        
                        // Broadcast updated user list to all clients
                        broadcastUserList(io);
                    }
                }, disconnectionGracePeriod);
                
                // Gracefully disconnect socket
                setTimeout(() => {
                    socket.disconnect(true);
                }, 500);
            } else {
                // Still have other sockets open, just acknowledge the logout for this socket
                socket.emit('user_logout_ack', { 
                    success: true, 
                    message: 'Socket disconnected, but user still has other active connections',
                    timestamp: new Date().toISOString(),
                    remainingSockets: userData.socketIds.size
                });
                
                // Disconnect just this socket
                socket.disconnect(true);
            }
        } else {
            // User not found in active users map
            socket.emit('user_logout_ack', { 
                success: false, 
                message: 'User not found in active users list',
                timestamp: new Date().toISOString()
            });
            socket.disconnect(true);
        }
        
        // Broadcast updated user list after logout
        broadcastUserList(io);
    });
    
    // Handle user activity through heartbeats and presence updates
    socket.on('user:heartbeat', () => {
        if (activeUsers.has(userId)) {
            activeUsers.get(userId).lastActivity = Date.now();
            
            // If user was inactive, mark them as online again
            const userData = activeUsers.get(userId);
            if (userData.status === 'inactive') {
                userData.status = 'online';
                broadcastUserList(io);
            }
        }
    });
    
    // Handle explicit presence status updates
    socket.on('user:presence', (data) => {
        if (!data || !data.status) return;
        
        if (activeUsers.has(userId)) {
            const userData = activeUsers.get(userId);
            const oldStatus = userData.status;
            userData.status = data.status;
            userData.lastActivity = Date.now();
            
            logger.info(`User ${username} presence status changed: ${oldStatus || 'online'} -> ${data.status}`);
            
            // Broadcast updated user list with new status
            broadcastUserList(io);
        }
    });
    
    // Share user with admins (for admin panels)
    socket.on('user:share-with-admin', (userData) => {
        // Find all admin sockets
        const adminSockets = Array.from(io.sockets.sockets.values())
            .filter(s => s.user && s.user.role === 'admin');
        
        // Share user data with admins only
        adminSockets.forEach(adminSocket => {
            adminSocket.emit('admin:user-connected', {
                ...userData,
                timestamp: Date.now()
            });
        });
    });
    
    // Get current user status
    socket.on('user:get-status', () => {
        if (activeUsers.has(userId)) {
            const userData = activeUsers.get(userId);
            socket.emit('user:status', {
                status: userData.status || 'online',
                lastActivity: userData.lastActivity,
                socketCount: userData.socketIds.size,
                timestamp: Date.now()
            });
        } else {
            socket.emit('user:status', {
                status: 'unknown',
                error: 'User not found in active users list',
                timestamp: Date.now()
            });
        }
    });
}

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
        
        // Format the message using standardized format
        const messageToSend = {
            username: socket.user.username,
            userId: socket.user.id,
            message: data.message.substring(0, 500), // Limit message length
            roomId: data.roomId || 'global',
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
            username: "System",
            userId: "system",
            roomId: 'global',
            timestamp: new Date().toISOString()
        });
    }
    
    // Handle disconnect event in chat handlers
    socket.on('disconnect', () => {
        handleDisconnect(io, socket);
    });
}

// Handle user authentication middleware
function setupAuthMiddleware(io, options = {}) {
    const logger = require('../../logger');
    const rateLimit = {};
    const MAX_ATTEMPTS = 5;
    const WINDOW_MS = 10 * 1000; // 10 seconds (changed from 10 minutes)
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
                return next(new Error('Too many authentication attempts. Try again in 10 seconds.'));
            }

            logger.info('Socket handshake received', {
                ip,
                auth: socket.handshake.auth,
                query: socket.handshake.query
            });

            const token = socket.handshake.auth?.token || socket.handshake.query?.token;
            const username = socket.handshake.auth?.username || socket.handshake.query?.username;
            const userId = socket.handshake.auth?.userId || socket.handshake.query?.userId;
            const isPreviousUser = socket.handshake.auth?.isPreviousUser || socket.handshake.query?.isPreviousUser;
            
            // Always force-remove any previous session for this username before allowing login
            if (username) {
                forceRemoveUserByUsername(username);
            }
            
            if (!token) {
                // Allow guest/test connections with just a username
                if (username) {
                    // Check if the username is already active but this is NOT a returning user with the same userId
                    if (isUsernameActive(username) && !(isPreviousUser && userId && hasMatchingUserIdForUsername(username, userId))) {
                        logger.warn('Username already active', username, ip);
                        return next(new Error('Username already in use. Please choose a different username.'));
                    }
                    
                    socket.user = {
                        id: userId || `guest_${Date.now()}_${Math.floor(Math.random()*10000)}`,
                        username,
                        role: 'guest',
                        guest: true,
                        isPreviousUser
                    };
                    
                    // If this is a returning user, explicitly remove any lingering sessions
                    if (isPreviousUser && userId) {
                        forceRemoveUserById(userId);
                        logger.info('Forced removal of previous user session before reconnect', {
                            username, 
                            userId,
                            ip
                        });
                    }
                    
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
                
                // After decoding token, also force-remove any previous session for this username (except this userId)
                if (decoded && decoded.username) {
                    for (const [userId, userData] of activeUsers.entries()) {
                        if (
                            userData.username.toLowerCase() === decoded.username.toLowerCase() &&
                            userId !== decoded.id
                        ) {
                            activeUsers.delete(userId);
                            require('../../logger').info(`[FORCE REMOVE] Token login: removed previous session for username: ${decoded.username} (userId: ${userId})`);
                        }
                    }
                }
                
                // PATCH: Allow connection if username is active but userId matches (same user/session)
                if (decoded.username && isUsernameActive(decoded.username)) {
                    // If the userId matches the active session, allow connection
                    if (!hasMatchingUserIdForUsername(decoded.username, decoded.id)) {
                        logger.warn('Username from token already active', decoded.username, ip);
                        return next(new Error('This account is already logged in elsewhere.'));
                    }
                    // else: allow connection
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
                rl.count++;
                logger.warn('Invalid authentication token', ip, err.message, token);
                return next(new Error('Invalid authentication token: ' + err.message));
            }
        } catch (err) {
            logger.error('Unexpected error in auth middleware', err.message, err.stack);
            next(new Error('Internal authentication error: ' + err.message));
        }
    });
}

// New function to expose active username checking
function checkUsernameAvailability(username) {
    return !isUsernameActive(username);
}

// Add this function to manually clean up persistent offline users
function clearOfflineUsers() {
    const logger = require('../../logger');
    let removedCount = 0;
    const now = Date.now();
    const usersToRemove = [];
    
    // Iterate through all users in the activeUsers map
    for (const [userId, userData] of activeUsers.entries()) {
        // Aggressive cleanup: Remove if no sockets, or if status is offline/inactive/disconnecting, or stale
        const isNoSockets = userData.socketIds.size === 0;
        const isInactiveStatus = userData.status === 'offline' || userData.status === 'inactive' || userData.status === 'disconnecting';
        const inactiveTime = now - userData.lastActivity;
        const staleTimeout = 60 * 1000; // 60 seconds (increased from 30)
        const isStale = inactiveTime > staleTimeout;

        if ((isNoSockets && isInactiveStatus) || isStale) {
            usersToRemove.push({
                userId,
                username: userData.username,
                status: userData.status,
                socketCount: userData.socketIds.size,
                inactiveSeconds: Math.round(inactiveTime/1000)
            });
        }
    }
    
    // Remove users in a separate loop to avoid modifying the map during iteration
    for (const user of usersToRemove) {
        logger.info(`[CLEANUP] Removing user: ${user.username} | userId: ${user.userId} | status: ${user.status} | sockets: ${user.socketCount} | inactive for: ${user.inactiveSeconds}s`);
        activeUsers.delete(user.userId);
        removedCount++;
    }
    
    logger.info(`[CLEANUP] Total users removed: ${removedCount}`);
    return removedCount;
}

// New handler for admin/testing purposes: completely reset all active users
function registerCleanupHandlers(io, socket) {
    const logger = require('../../logger');
    
    // Handler for clearing offline users
    socket.on('clear_offline_users', () => {
        if (socket.user && socket.user.role === 'admin') {
            const removedCount = clearOfflineUsers();
            logger.info(`Admin ${socket.user.username} cleared ${removedCount} offline users`);
            socket.emit('offline_users_cleared', { count: removedCount });
            
            // Update the user list
            broadcastUserList(io);
        } else {
            // Allow this operation for testing page even for non-admins
            const removedCount = clearOfflineUsers();
            logger.info(`User ${socket.user?.username || 'Anonymous'} cleared ${removedCount} offline users`);
            socket.emit('offline_users_cleared', { count: removedCount });
            
            // Update the user list
            broadcastUserList(io);
        }
    });
    
    // Handler for completely resetting all active users
    socket.on('reset_all_users', () => {
        if (socket.user && socket.user.role === 'admin') {
            const removedCount = clearAllUsers();
            logger.info(`Admin ${socket.user.username} reset all ${removedCount} active users`);
            socket.emit('all_users_reset', { count: removedCount });
            
            // Update the user list
            broadcastUserList(io);
        } else {
            // Allow this operation for testing page even for non-admins
            const removedCount = clearAllUsers();
            logger.info(`User ${socket.user?.username || 'Anonymous'} reset all ${removedCount} active users`);
            socket.emit('all_users_reset', { count: removedCount });
            
            // Update the user list
            broadcastUserList(io);
        }
    });
}

// Expose functions for use by other modules
module.exports = {
    registerQuizHandlers,
    registerChatHandlers,
    registerPresenceHandlers,
    registerCleanupHandlers,
    setupAuthMiddleware,
    handleDisconnect,
    broadcastUserList,
    clearAllUsers,
    isUsernameActive,
    checkUsernameAvailability,
    clearOfflineUsers,
    hasMatchingUserIdForUsername,
    forceRemoveUserById,
    forceRemoveUserByUsername
};
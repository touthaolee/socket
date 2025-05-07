// Update server-side/server-socket/socket-handlers.js

const jwt = require('jsonwebtoken');
const config = require('../../config/app-config');

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
            let decoded;
            try {
                decoded = await new Promise((resolve, reject) => {
                    require('jsonwebtoken').verify(token, require('../../config/app-config').jwt.secret, (err, decoded) => {
                        if (err) reject(err);
                        else resolve(decoded);
                    });
                });
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

module.exports = {
    registerQuizHandlers,
    setupAuthMiddleware,
    registerChatHandlers,
    handleDisconnect
};
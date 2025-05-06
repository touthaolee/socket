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

            // --- DETAILED LOGGING START ---
            logger.info('Socket handshake received', {
                ip,
                auth: socket.handshake.auth,
                query: socket.handshake.query
            });
            // --- DETAILED LOGGING END ---

            const token = socket.handshake.auth?.token || socket.handshake.query?.token;
            if (!token) {
                rl.count++;
                logger.warn('Authentication token missing', ip, socket.handshake.auth);
                return next(new Error('Authentication token missing'));
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
            // Optional: role check
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

module.exports = {
    registerQuizHandlers,
    setupAuthMiddleware
};
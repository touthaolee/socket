// Update server-side/server-socket/socket-handlers.js

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

module.exports = {
    registerQuizHandlers
};
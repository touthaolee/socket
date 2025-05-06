// server-side/server-services/background-processing-service.js

const EventEmitter = require('events');
const logger = require('../../logger');
const aiGenerationService = require('./ai-generation-service');
const quizService = require('./quiz-service');

// Create event emitter for progress updates
const processingEvents = new EventEmitter();

// Store active processing jobs
const activeJobs = new Map();

const backgroundProcessingService = {
    /**
     * Generate quiz questions in the background
     * @param {number} quizId - The ID of the quiz to generate questions for
     * @param {object} config - Configuration for generation
     * @returns {string} - Job ID for tracking progress
     */
    startQuizGeneration(quizId, config) {
        const jobId = `quiz_gen_${Date.now()}_${quizId}`;
        
        // Set up the generation process
        const process = async () => {
            try {
                // Get the quiz
                const quiz = await quizService.getQuizById(quizId);
                if (!quiz) {
                    throw new Error('Quiz not found');
                }
                
                // Set up progress tracking
                let progress = {
                    jobId,
                    quizId,
                    status: 'processing',
                    percentComplete: 0,
                    startTime: Date.now(),
                    config
                };
                
                // Update progress initially
                activeJobs.set(jobId, progress);
                processingEvents.emit('progress', { ...progress });
                
                // Generate questions
                const result = await aiGenerationService.generateQuestionBatch(
                    config.topic || quiz.title,
                    config.count || 10,
                    {
                        difficulty: config.difficulty || 'medium',
                        tone: config.tone || 'educational',
                        specificFocuses: config.specificFocuses,
                        progressCallback: (progressData) => {
                            // Update and emit progress
                            progress = {
                                ...progress,
                                ...progressData,
                                percentComplete: progressData.percentComplete,
                                estimatedTimeRemaining: progressData.estimatedRemainingMs
                            };
                            activeJobs.set(jobId, progress);
                            processingEvents.emit('progress', { ...progress });
                        }
                    }
                );
                
                // If successful, update the quiz with the new questions
                if (result.success && result.questions.length > 0) {
                    // Format questions for storage
                    const formattedQuestions = result.questions.map(q => ({
                        text: q.text,
                        options: q.options.map(o => ({
                            text: o.text,
                            isCorrect: o.isCorrect,
                            rationale: o.rationale || ''
                        }))
                    }));
                    
                    // Update the quiz
                    await quizService.updateQuiz(quizId, {
                        questions: formattedQuestions,
                        generatedAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    });
                    
                    // Update final progress
                    progress = {
                        ...progress,
                        status: 'completed',
                        percentComplete: 100,
                        endTime: Date.now(),
                        result: {
                            success: true,
                            questionCount: formattedQuestions.length
                        }
                    };
                } else {
                    // Handle partial success or failure
                    progress = {
                        ...progress,
                        status: result.questions.length > 0 ? 'partial' : 'failed',
                        percentComplete: Math.round((result.questions.length / config.count) * 100),
                        endTime: Date.now(),
                        result: {
                            success: result.questions.length > 0,
                            questionCount: result.questions.length,
                            errors: result.errors
                        }
                    };
                }
                
                // Save final progress and emit update
                activeJobs.set(jobId, progress);
                processingEvents.emit('progress', { ...progress });
                
                // Clean up job after some time
                setTimeout(() => {
                    activeJobs.delete(jobId);
                }, 3600000); // Keep job info for 1 hour
                
            } catch (error) {
                logger.error(`Background processing error for job ${jobId}:`, error);
                
                // Update job as failed
                const progress = {
                    ...activeJobs.get(jobId),
                    status: 'failed',
                    endTime: Date.now(),
                    error: error.message
                };
                
                activeJobs.set(jobId, progress);
                processingEvents.emit('progress', { ...progress });
                
                // Clean up job after some time
                setTimeout(() => {
                    activeJobs.delete(jobId);
                }, 3600000); // Keep job info for 1 hour
            }
        };
        
        // Start the process
        process().catch(error => {
            logger.error(`Error starting background process for job ${jobId}:`, error);
        });
        
        return jobId;
    },
    
    /**
     * Get the current progress of a background job
     * @param {string} jobId - The ID of the job
     * @returns {object|null} - The job progress or null if not found
     */
    getJobProgress(jobId) {
        return activeJobs.get(jobId) || null;
    },
    
    /**
     * Get progress events emitter
     * @returns {EventEmitter} - The progress events emitter
     */
    getProgressEmitter() {
        return processingEvents;
    }
};

// Periodic cleanup for old jobs (runs every hour)
setInterval(() => {
    const now = Date.now();
    const ONE_HOUR = 3600000;
    for (const [jobId, job] of activeJobs.entries()) {
        if (job.endTime && now - job.endTime > ONE_HOUR) {
            activeJobs.delete(jobId);
        }
    }
}, 3600000); // Run every hour

module.exports = backgroundProcessingService;
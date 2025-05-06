// server-side/server-services/quiz-error-correction-service.js

const logger = require('../../logger');
const quizService = require('./quiz-service');
const aiGenerationService = require('./ai-generation-service');

const quizErrorCorrectionService = {
    /**
     * Check and fix issues in a quiz's questions
     * @param {number} quizId - The quiz ID
     * @returns {Promise<object>} - Results of the correction process
     */
    async correctQuizQuestions(quizId) {
        try {
            // Get the quiz
            const quiz = await quizService.getQuizById(quizId);
            if (!quiz) {
                throw new Error('Quiz not found');
            }
            
            if (!quiz.questions || !Array.isArray(quiz.questions)) {
                logger.warn(`Quiz ${quizId} has no questions array.`);
                return { success: false, message: 'No questions to correct' };
            }
            
            const corrections = [];
            let changed = false;
            
            // Check each question for issues
            for (let i = 0; i < quiz.questions.length; i++) {
                const q = quiz.questions[i];
                let needsFix = false;
                
                // Check for missing/empty options
                if (!Array.isArray(q.options) || q.options.length < 2) {
                    corrections.push({
                        questionIndex: i,
                        issue: 'Missing options array or too few options',
                        fixed: false
                    });
                    continue; // Skip questions with fundamental structural issues
                }
                
                // Check for empty options
                if (q.options.some(opt => !opt.text || !opt.text.trim())) {
                    corrections.push({
                        questionIndex: i,
                        issue: 'One or more empty options',
                        fixed: false
                    });
                    continue;
                }
                
                // Check if exactly one correct option is marked
                const correctOptions = q.options.filter(o => o.isCorrect);
                if (correctOptions.length !== 1) {
                    corrections.push({
                        questionIndex: i,
                        issue: `Found ${correctOptions.length} correct options, should be exactly 1`,
                        fixed: false
                    });
                    continue;
                }
                
                // Check for missing rationales
                if (!q.options.every(o => o.rationale && o.rationale.trim())) {
                    needsFix = true;
                    
                    // Try to add missing rationales
                    const missingRationales = q.options.some(o => !o.rationale || !o.rationale.trim());
                    
                    if (missingRationales) {
                        try {
                            // Generate rationales for all options
                            const optionTexts = q.options.map(o => o.text);
                            const correctOption = q.options.find(o => o.isCorrect).text;
                            
                            // Find correct option index
                            const correctIndex = q.options.findIndex(o => o.isCorrect);
                            
                            const rationales = await aiGenerationService.generateConciseRationalesForAllOptions({
                                question: q.text,
                                options: optionTexts,
                                correctIndex,
                                style: 'educational' // Default style
                            });
                            
                            // Update the rationales
                            for (let j = 0; j < q.options.length; j++) {
                                if (!q.options[j].rationale || !q.options[j].rationale.trim()) {
                                    q.options[j].rationale = rationales[j] || 
                                        (q.options[j].isCorrect 
                                            ? 'This is the correct answer.' 
                                            : 'This answer is incorrect.');
                                }
                            }
                            
                            changed = true;
                            corrections.push({
                                questionIndex: i,
                                issue: 'Missing rationales',
                                fixed: true
                            });
                        } catch (rationaleError) {
                            logger.error(`Failed to generate rationales for quiz ${quizId} question ${i}:`, rationaleError);
                            corrections.push({
                                questionIndex: i,
                                issue: 'Missing rationales',
                                fixed: false,
                                error: rationaleError.message
                            });
                            
                            // Add minimal placeholder rationales
                            for (let j = 0; j < q.options.length; j++) {
                                if (!q.options[j].rationale || !q.options[j].rationale.trim()) {
                                    q.options[j].rationale = q.options[j].isCorrect 
                                        ? 'This is the correct answer.' 
                                        : 'This answer is incorrect.';
                                }
                            }
                            changed = true;
                        }
                    }
                }
            }
            
            // Save the updated quiz if changes were made
            if (changed) {
                await quizService.updateQuiz(quizId, {
                    questions: quiz.questions,
                    updatedAt: new Date().toISOString(),
                    correctedAt: new Date().toISOString()
                });
                
                logger.info(`Fixed quiz ${quizId} with ${corrections.filter(c => c.fixed).length} corrections`);
                
                return {
                    success: true,
                    message: `Fixed ${corrections.filter(c => c.fixed).length} issues`,
                    corrections,
                    quizId
                };
            }
            
            // If no corrections could be made but issues were found
            if (corrections.length > 0) {
                return {
                    success: false,
                    message: `Found ${corrections.length} issues but could not fix automatically`,
                    corrections,
                    quizId
                };
            }
            
            // No issues found
            return {
                success: true,
                message: 'No issues found',
                quizId
            };
            
        } catch (error) {
            logger.error(`Error correcting quiz ${quizId}:`, error);
            throw error;
        }
    }
};

module.exports = quizErrorCorrectionService;
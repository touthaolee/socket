// Create a new file: server-side/server-services/quiz-regeneration-service.js

const fs = require('fs');
const path = require('path');
const aiGenerationService = require('./ai-generation-service');
const quizService = require('./quiz-service');
const logger = require('../../logger');

class QuizRegenerationError extends Error {
    constructor(message, code = null, details = null) {
        super(message);
        this.name = 'QuizRegenerationError';
        this.code = code;
        this.details = details;
    }
}

const quizRegenerationService = {
    /**
     * Regenerate a single question in a quiz
     * @param {number} quizId - The ID of the quiz
     * @param {number} questionIndex - The index of the question to regenerate
     * @param {object} options - Options for regeneration
     * @returns {Promise<object>} - The updated quiz
     */
    async regenerateQuestion(quizId, questionIndex, options = {}) {
        try {
            // Get the quiz
            const quiz = await quizService.getQuizById(quizId);
            if (!quiz) {
                throw new QuizRegenerationError('Quiz not found', 'QUIZ_NOT_FOUND');
            }
            
            // Validate the question index
            if (!quiz.questions || !Array.isArray(quiz.questions) || 
                questionIndex < 0 || questionIndex >= quiz.questions.length) {
                throw new QuizRegenerationError('Invalid question index', 'INVALID_INDEX');
            }
            
            // Get topic from quiz title if not provided
            const topic = options.topic || quiz.title;
            
            // Get other question texts to ensure uniqueness
            const otherQuestions = quiz.questions
                .filter((_, i) => i !== questionIndex)
                .map(q => q.text);
            
            // Generate a new question
            const newQuestion = await aiGenerationService.generateQuestion(
                topic,
                options.difficulty || 'medium',
                options.optionsCount || 4,
                options.tone || 'educational'
            );
            
            // Format the new question to match the existing structure
            const formattedQuestion = {
                text: newQuestion.text,
                options: newQuestion.options.map(o => ({
                    text: o.text,
                    isCorrect: o.isCorrect,
                    rationale: o.rationale
                })),
                regeneratedAt: new Date().toISOString()
            };
            
            // Update the quiz with the new question
            const updatedQuestions = [...quiz.questions];
            updatedQuestions[questionIndex] = formattedQuestion;
            
            // Save the updated quiz
            const updatedQuiz = await quizService.updateQuiz(quizId, {
                ...quiz,
                questions: updatedQuestions,
                updatedAt: new Date().toISOString()
            });
            
            return updatedQuiz;
        } catch (error) {
            logger.error('Error regenerating question:', error);
            if (error instanceof QuizRegenerationError) {
                throw error;
            }
            throw new QuizRegenerationError(`Failed to regenerate question: ${error.message}`, 'REGENERATION_ERROR');
        }
    }
};

module.exports = quizRegenerationService;
// Simple service registry for dependency management
const authService = require('./server-services/auth-service');
const quizService = require('./server-services/quiz-service');
const aiGenerationService = require('./server-services/ai-generation-service');
const aiSimilarityService = require('./server-services/ai-similarity-service');

module.exports = {
  authService,
  quizService,
  aiGenerationService,
  aiSimilarityService,
};

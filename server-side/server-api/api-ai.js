/**
 * AI API Endpoints
 * Handles API routes for AI-powered features
 */

const express = require('express');
const router = express.Router();
const aiGenerationService = require('../server-services/ai-generation-service');
const aiSimilarityService = require('../server-services/ai-similarity-service');
const { authMiddleware } = require('../middleware/auth-middleware');

// Protect all AI endpoints with authentication
router.use(authMiddleware);

/**
 * Test endpoint for quickly verifying generateQuestions function
 * GET /api/ai/test-generate
 */
router.get('/test-generate', async (req, res) => {
  try {
    // Simple test parameters
    const topic = "Basic JavaScript concepts";
    const numQuestions = 2;
    
    console.log('Test endpoint: Calling generateQuestions...');
    const questions = await aiGenerationService.generateQuestions(
      topic, 
      numQuestions,
      'easy',
      'educational'
    );
    
    console.log('Test endpoint: Generation successful!');
    res.json({ success: true, questions });
  } catch (error) {
    console.error('Test endpoint error:', error);
    res.status(500).json({ 
      error: 'Test generate failed',
      message: error.message,
      details: error.stack
    });
  }
});

/**
 * Generate quiz questions
 * POST /api/ai/generate-questions
 */
router.post('/generate-questions', async (req, res) => {
  try {
    const { topic, numQuestions, difficulty, tone } = req.body;
    
    // Validate required fields
    if (!topic || !numQuestions) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Log the request parameters
    console.log(`Generating ${numQuestions} questions about "${topic}" (${difficulty || 'medium'} difficulty)`);
      // Generate questions
    const questions = await aiGenerationService.generateQuestions(
      topic, 
      numQuestions,
      difficulty,
      tone
    );
    
    // Log success
    console.log(`Successfully generated ${questions.length} questions`);
    
    // Ensure all questions have the required structure before sending
    const processedQuestions = questions.map(q => {
      // Make sure each question has the essential properties
      const processedQ = {
        text: q.text || "",
        options: Array.isArray(q.options) ? q.options : [],
        correctIndex: typeof q.correctIndex === 'number' ? q.correctIndex : 0,
        rationale: q.rationale || ""
      };
      
      return processedQ;
    });
    
    // Return the questions
    res.json({ 
      success: true, 
      questions: processedQuestions,
      count: processedQuestions.length,
      requestedCount: numQuestions
    });
  } catch (error) {
    console.error('Error generating questions:', error);
    // Enhanced error reporting
    res.status(500).json({ 
      error: 'Failed to generate questions',
      message: error.message,
      details: error.stack ? { stack: error.stack, cause: error.cause || null } : undefined,
      suggestion: error.message && error.message.includes('API key')
        ? 'Check that your AI API key is set and valid on the server.'
        : undefined
    });
  }
});

/**
 * Generate a single question
 * POST /api/ai/generate-question
 */
router.post('/generate-question', async (req, res) => {
  try {
    const { topic, difficulty, tone, previousQuestions } = req.body;
    
    // Validate required fields
    if (!topic) {
      return res.status(400).json({ error: 'Missing topic' });
    }
    
    // Generate a single question
    const question = await aiGenerationService.generateQuizQuestion(
      topic, 
      difficulty,
      tone,
      previousQuestions
    );
    
    res.json({ success: true, question });
  } catch (error) {
    console.error('Error generating question:', error);
    // Enhanced error reporting
    res.status(500).json({ 
      error: 'Failed to generate question',
      message: error.message,
      details: error.stack ? { stack: error.stack, cause: error.cause || null } : undefined,
      suggestion: error.message && error.message.includes('API key')
        ? 'Check that your AI API key is set and valid on the server.'
        : undefined
    });
  }
});

/**
 * Regenerate a specific question
 * POST /api/ai/regenerate-question
 */
router.post('/regenerate-question', async (req, res) => {
  try {
    const { questionId, topic, difficulty, tone, previousQuestions } = req.body;
    
    // Validate required fields
    if (!questionId || !topic) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Regenerate the question
    const question = await aiGenerationService.regenerateQuestion(
      questionId,
      topic, 
      difficulty,
      tone,
      previousQuestions
    );
    
    res.json({ success: true, question });
  } catch (error) {
    console.error('Error regenerating question:', error);
    res.status(500).json({ 
      error: 'Failed to regenerate question',
      message: error.message
    });
  }
});

/**
 * Generate rationale for an answer
 * POST /api/ai/generate-rationale
 */
router.post('/generate-rationale', async (req, res) => {
  try {
    const { question, correctAnswer, tone } = req.body;
    
    // Validate required fields
    if (!question || !correctAnswer) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Generate rationale
    const rationale = await aiGenerationService.generateRationale(
      question,
      correctAnswer,
      tone
    );
    
    res.json({ success: true, rationale });
  } catch (error) {
    console.error('Error generating rationale:', error);
    res.status(500).json({ 
      error: 'Failed to generate rationale',
      message: error.message
    });
  }
});

/**
 * Check similarity between questions
 * POST /api/ai/similarity/check
 */
router.post('/similarity/check', async (req, res) => {
  try {
    const { mainQuestion, compareQuestions } = req.body;
    
    // Validate required fields
    if (!mainQuestion || !compareQuestions || !Array.isArray(compareQuestions)) {
      return res.status(400).json({ error: 'Missing or invalid required fields' });
    }
    
    // Check similarity
    const similarityResults = await aiSimilarityService.checkSimilarity(
      mainQuestion,
      compareQuestions
    );
    
    res.json(similarityResults);
  } catch (error) {
    console.error('Error checking similarity:', error);
    res.status(500).json({ 
      error: 'Failed to check similarity',
      message: error.message 
    });
  }
});

/**
 * Check similarity across a batch of questions
 * POST /api/ai/similarity/batch-check
 */
router.post('/similarity/batch-check', async (req, res) => {
  try {
    const { questions } = req.body;
    
    // Validate required fields
    if (!questions || !Array.isArray(questions)) {
      return res.status(400).json({ error: 'Missing or invalid questions array' });
    }
    
    // Check batch similarity
    const batchResults = await aiSimilarityService.checkBatchSimilarity(questions);
    
    res.json(batchResults);
  } catch (error) {
    console.error('Error checking batch similarity:', error);
    res.status(500).json({ 
      error: 'Failed to check batch similarity',
      message: error.message 
    });
  }
});

module.exports = router;
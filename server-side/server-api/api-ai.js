// server-side/server-api/api-ai.js
const express = require('express');
const router = express.Router();
const { authService, aiGenerationService } = require('../service-registry');
const logger = require('../../logger');

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  const decoded = authService.verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: 'Invalid token' });
  }
  
  req.userId = decoded.id;
  next();
};

// Generate a quiz question
router.post('/generate-question', verifyToken, async (req, res) => {
  try {
    const { topic, difficulty, rationaleTone, optionsCount, specificFocus } = req.body;
    
    if (!topic) {
      return res.status(400).json({ error: 'Topic is required' });
    }
    
    // Check for Gemini API key before attempting to generate
    if (!process.env.GEMINI_API_KEY) {
      logger.error('GEMINI_API_KEY environment variable is missing, API request will fail');
      return res.status(500).json({ 
        error: 'Server configuration error: GEMINI_API_KEY is missing',
        details: 'The server is missing the Gemini API key in its environment configuration'
      });
    }
    
    logger.info(`Generating question for topic: "${topic}", difficulty: ${difficulty || 'medium'}`);
    
    try {
      const question = await aiGenerationService.generateQuestion(
        topic,
        difficulty || 'medium',
        optionsCount || 4,
        rationaleTone || 'educational',
        specificFocus
      );
      
      logger.info('Question generated successfully');
      res.json(question);
    } catch (aiError) {
      logger.error('AI generation failed:', aiError);
      
      // Return more detailed error information to help diagnose the issue
      let errorDetails = {};
      
      if (aiError.message && aiError.message.includes('API key')) {
        errorDetails = {
          type: 'api_key_error',
          message: 'There was an issue with the Gemini API key',
          suggestion: 'Verify that the GEMINI_API_KEY in the server environment is valid and has not expired'
        };
      } else if (aiError.message && aiError.message.includes('rate limit')) {
        errorDetails = {
          type: 'rate_limit_error',
          message: 'The server is being rate-limited by the Gemini API',
          suggestion: 'Try again later when rate limits have reset'
        };
      } else if (aiError.message && aiError.message.includes('parse')) {
        errorDetails = {
          type: 'parsing_error',
          message: 'The server received a response from Gemini but could not parse it correctly',
          suggestion: 'This is a server-side issue, please report it to the administrator'
        };
      }
      
      res.status(500).json({ 
        error: 'Failed to generate question', 
        details: errorDetails
      });
    }
  } catch (error) {
    logger.error('Error in generate-question endpoint:', error);
    res.status(500).json({ error: 'Failed to process question generation request' });
  }
});

// Generate a rationale
router.post('/generate-rationale', verifyToken, async (req, res) => {
  try {
    const { question, correctAnswer, incorrectAnswers, tone } = req.body;
    
    if (!question || !correctAnswer) {
      return res.status(400).json({ error: 'Question and correct answer are required' });
    }
    
    const rationale = await aiGenerationService.generateRationale(
      question,
      correctAnswer,
      incorrectAnswers || [],
      tone || 'educational'
    );
    
    res.json({ rationale });
  } catch (error) {
    console.error('Error generating rationale:', error);
    res.status(500).json({ error: 'Failed to generate rationale' });
  }
});

// Check similarity between questions
router.post('/check-similarity', verifyToken, async (req, res) => {
  try {
    const { questions } = req.body;
    
    if (!questions || !Array.isArray(questions) || questions.length < 2) {
      return res.status(400).json({ error: 'At least two questions are required' });
    }
    
    const similarityGroups = await aiGenerationService.checkSimilarity(questions);
    
    res.json(similarityGroups);
  } catch (error) {
    console.error('Error checking similarity:', error);
    res.status(500).json({ error: 'Failed to check similarity' });
  }
});

module.exports = router;
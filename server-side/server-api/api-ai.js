// server-side/server-api/api-ai.js
const express = require('express');
const router = express.Router();
const authService = require('../server-services/auth-service');
const aiGenerationService = require('../server-services/ai-generation-service');

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
    
    const question = await aiGenerationService.generateQuestion(
      topic,
      difficulty || 'medium',
      optionsCount || 4,
      rationaleTone || 'educational',
      specificFocus
    );
    
    res.json(question);
  } catch (error) {
    console.error('Error generating question:', error);
    res.status(500).json({ error: 'Failed to generate question' });
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
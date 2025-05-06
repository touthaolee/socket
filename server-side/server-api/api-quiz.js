// server-side/server-api/api-quiz.js
// Add this at the top of api-quiz.js
const withMinProcessingTime = async (promise, minTime = 1500) => {
  const start = Date.now();
  const result = await promise;
  const elapsed = Date.now() - start;
  if (elapsed < minTime) {
      await new Promise(resolve => setTimeout(resolve, minTime - elapsed));
  }
  return result;
};
const express = require('express');
const router = express.Router();
const { authService, quizService, aiSimilarityService } = require('../service-registry');
const quizErrorCorrectionService = require('../server-services/quiz-error-correction-service');
const quizRegenerationService = require('../server-services/quiz-regeneration-service');

// Add this new route

// Check and fix quiz issues
router.post('/quizzes/:id/quality-check', verifyToken, async (req, res) => {
    try {
        const quizId = parseInt(req.params.id, 10);
        
        if (isNaN(quizId)) {
            return res.status(400).json({ error: 'Invalid quiz ID' });
        }
        
        // Get the quiz to check if it exists
        const quiz = await quizService.getQuizById(quizId);
        if (!quiz) {
            return res.status(404).json({ error: 'Quiz not found' });
        }
        
        // Check if user is authorized (admin or creator)
        if (req.userId !== quiz.createdBy && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Not authorized to check this quiz' });
        }
        
        // Run quality check
        const results = await quizErrorCorrectionService.correctQuizQuestions(quizId);
        
        res.json(results);
    } catch (error) {
        console.error('Error checking quiz quality:', error);
        res.status(500).json({ error: 'Failed to check quiz quality' });
    }
});
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

// Get all quizzes
router.get('/quizzes', verifyToken, async (req, res) => {
  try {
    const quizzes = await quizService.getAllQuizzes();
    res.json(quizzes);
  } catch (error) {
    console.error('Error getting quizzes:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get a specific quiz
router.get('/quizzes/:id', verifyToken, async (req, res) => {
  try {
    const quiz = await quizService.getQuizById(req.params.id);
    
    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }
    
    res.json(quiz);
  } catch (error) {
    console.error('Error getting quiz:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create a new quiz
router.post('/quizzes', verifyToken, async (req, res) => {
  try {
    const { title, description, questions } = req.body;
    
    if (!title || !questions || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: 'Title and questions are required' });
    }
    
    const quiz = await quizService.createQuiz({
      title,
      description,
      questions,
      createdBy: req.userId
    });
    
    res.status(201).json(quiz);
  } catch (error) {
    console.error('Error creating quiz:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete a quiz
router.delete('/quizzes/:id', verifyToken, async (req, res) => {
  try {
    const quiz = await quizService.getQuizById(req.params.id);
    
    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }
    
    if (quiz.createdBy !== req.userId) {
      return res.status(403).json({ error: 'Not authorized to delete this quiz' });
    }
    
    await quizService.deleteQuiz(req.params.id);
    
    res.json({ message: 'Quiz deleted successfully' });
  } catch (error) {
    console.error('Error deleting quiz:', error);
    res.status(500).json({ error: 'Server error' });
  }
});
// Add to server-side/server-api/api-quiz.js

// Regenerate a question
router.post('/quizzes/:id/questions/:index/regenerate', verifyToken, async (req, res) => {
    try {
        const quizId = parseInt(req.params.id, 10);
        const questionIndex = parseInt(req.params.index, 10);
        
        if (isNaN(quizId) || isNaN(questionIndex)) {
            return res.status(400).json({ error: 'Invalid quiz ID or question index' });
        }
        
        const options = {
            difficulty: req.body.difficulty,
            topic: req.body.topic,
            tone: req.body.tone,
            userId: req.userId
        };
        
        const updatedQuiz = await quizRegenerationService.regenerateQuestion(quizId, questionIndex, options);
        
        res.json({
            success: true,
            quiz: updatedQuiz
        });
    } catch (error) {
        console.error('Error regenerating question:', error);
        
        if (error.code === 'QUIZ_NOT_FOUND') {
            return res.status(404).json({ error: 'Quiz not found' });
        }
        
        if (error.code === 'INVALID_INDEX') {
            return res.status(400).json({ error: 'Invalid question index' });
        }
        
        res.status(500).json({ error: 'Failed to regenerate question' });
    }
});
// Add to server-side/server-api/api-quiz.js

// Create a quiz with AI-generated questions
router.post('/quizzes/ai-generate', verifyToken, async (req, res) => {
  try {
      const { title, description, aiTopic, questionCount, difficulty, rationaleTone } = req.body;
      
      if (!title || !aiTopic) {
          return res.status(400).json({ error: 'Title and AI topic are required' });
      }
      
      const quiz = await quizService.createQuizWithAI({
          title,
          description,
          createdBy: req.userId,
          generateWithAI: true,
          aiTopic,
          questionCount: parseInt(questionCount, 10) || 10,
          difficulty: difficulty || 'medium',
          rationaleTone: rationaleTone || 'educational'
      });
      
      res.status(201).json({
          success: true,
          quiz,
          message: 'Quiz created successfully. Questions are being generated in the background.',
          generationJobId: quiz.generationJobId
      });
  } catch (error) {
      console.error('Error creating quiz with AI generation:', error);
      res.status(500).json({ error: 'Failed to create quiz with AI generation' });
  }
});

// Get quiz generation status
router.get('/quizzes/:id/generation-status', verifyToken, async (req, res) => {
  try {
      const quizId = parseInt(req.params.id, 10);
      
      if (isNaN(quizId)) {
          return res.status(400).json({ error: 'Invalid quiz ID' });
      }
      
      const status = await quizService.getQuizGenerationStatus(quizId);
      
      res.json({
          quizId,
          ...status
      });
  } catch (error) {
      console.error('Error getting quiz generation status:', error);
      
      if (error.message === 'Quiz not found') {
          return res.status(404).json({ error: 'Quiz not found' });
      }
      
      res.status(500).json({ error: 'Failed to get quiz generation status' });
  }
});
// Check question similarity
router.post('/quizzes/check-similarity', verifyToken, async (req, res) => {
    try {
        const { questions } = req.body;
        
        if (!questions || !Array.isArray(questions) || questions.length < 2) {
            return res.status(400).json({ error: 'At least two questions are required' });
        }
        
        // Ensure minimum processing time for better UX
        const result = await withMinProcessingTime(
            aiSimilarityService.checkQuestionSimilarity(questions),
            1500
        );
        
        res.json(result);
    } catch (error) {
        console.error('Error checking question similarity:', error);
        res.status(500).json({ error: 'Failed to check similarity' });
    }
});
module.exports = router;
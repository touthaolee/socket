// server-side/server-api/api-quiz.js
const express = require('express');
const router = express.Router();
const authService = require('../server-services/auth-service');
const quizService = require('../server-services/quiz-service');

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

module.exports = router;
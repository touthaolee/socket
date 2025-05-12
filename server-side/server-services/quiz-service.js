// server-side/server-services/quiz-service.js
const fs = require('fs');
const path = require('path');
const fileUtils = require('./file-utils');

// Path to the quizzes data file
const DB_FILE = path.join(__dirname, '../../data/quizzes.json');

// Ensure the data directory exists
const dataDir = path.dirname(DB_FILE);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize quizzes database if not exists
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify({ quizzes: [], nextId: 1 }, null, 2));
}

const quizService = {  // Get all quizzes
  async getAllQuizzes(page = 1, limit = 10) {
    try {
      console.log('Getting all quizzes, page:', page, 'limit:', limit);
      const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      
      // Add pagination support
      const startIndex = (page - 1) * limit;
      const endIndex = page * limit;
      const paginatedQuizzes = data.quizzes.slice(startIndex, endIndex);
      
      const totalPages = Math.ceil(data.quizzes.length / limit);
      console.log('Total quizzes:', data.quizzes.length, 'Total pages:', totalPages);
      
      return {
        quizzes: paginatedQuizzes,
        totalPages: totalPages,
        currentPage: page,
        totalQuizzes: data.quizzes.length
      };
    } catch (error) {
      console.error('Error getting all quizzes:', error);
      return { quizzes: [], totalPages: 1, currentPage: 1, totalQuizzes: 0 };
    }
  },
  
  // Get quiz by ID
  async getQuizById(id) {
    try {
      const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      return data.quizzes.find(quiz => quiz.id === parseInt(id, 10));
    } catch (error) {
      console.error('Error getting quiz by ID:', error);
      return null;
    }
  },
  // Update server-side/server-services/quiz-service.js

// Add these methods to the quizService object

// Create a quiz with AI-generated questions
async createQuizWithAI(quizData) {
  try {
      // First create the quiz with basic info
      const quiz = await this.createQuiz({
          title: quizData.title,
          description: quizData.description || '',
          createdBy: quizData.createdBy,
          status: 'generating' // Mark as generating
      });
      
      // Start background generation if AI details provided
      if (quizData.generateWithAI && quizData.aiTopic) {
          const backgroundProcessingService = require('./background-processing-service');
          
          // Start generation process
          const jobId = backgroundProcessingService.startQuizGeneration(quiz.id, {
              topic: quizData.aiTopic,
              count: quizData.questionCount || 10,
              difficulty: quizData.difficulty || 'medium',
              tone: quizData.rationaleTone || 'educational'
          });
          
          // Add job ID to quiz for tracking
          await this.updateQuiz(quiz.id, {
              generationJobId: jobId
          });
          
          // Return quiz with job ID
          return {
              ...quiz,
              generationJobId: jobId
          };
      }
      
      return quiz;
  } catch (error) {
      console.error('Error creating quiz with AI:', error);
      throw error;
  }
},

// Get generation status for a quiz
async getQuizGenerationStatus(quizId) {
  try {
      const quiz = await this.getQuizById(quizId);
      
      if (!quiz) {
          throw new Error('Quiz not found');
      }
      
      if (!quiz.generationJobId) {
          return { status: 'not_generating' };
      }
      
      const backgroundProcessingService = require('./background-processing-service');
      const progress = backgroundProcessingService.getJobProgress(quiz.generationJobId);
      
      if (!progress) {
          return { status: 'unknown', generationJobId: quiz.generationJobId };
      }
      
      return progress;
  } catch (error) {
      console.error('Error getting quiz generation status:', error);
      throw error;
  }
},  // Create a new quiz
  async createQuiz(quizData) {
    try {
      console.log('Creating quiz with data:', quizData);
      const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      
      const newQuiz = {
        id: data.nextId++,
        name: quizData.title, // Using 'name' for frontend compatibility
        title: quizData.title,
        description: quizData.description || '',
        questions: quizData.questions || [],
        timePerQuestion: quizData.timePerQuestion || 30,
        status: quizData.status || 'draft',
        createdBy: quizData.createdBy,
        createdAt: new Date().toISOString()
      };
      
      data.quizzes.push(newQuiz);
      fileUtils.atomicWriteFileSync(DB_FILE, JSON.stringify(data, null, 2));
      
      console.log('Created new quiz:', newQuiz);
      return newQuiz;
    } catch (error) {
      console.error('Error creating quiz:', error);
      throw error;
    }
  },
    // Update a quiz
  async updateQuiz(id, quizData) {
    try {
      const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      const index = data.quizzes.findIndex(quiz => quiz.id === parseInt(id, 10));
      
      if (index === -1) {
        throw new Error('Quiz not found');
      }
      const updatedQuiz = {
        ...data.quizzes[index],
        title: quizData.title || data.quizzes[index].title,
        name: quizData.title || data.quizzes[index].title, // Keep name in sync with title
        description: quizData.description || data.quizzes[index].description,
        questions: quizData.questions || data.quizzes[index].questions,
        status: quizData.status || data.quizzes[index].status, // Make sure status gets updated
        updatedAt: new Date().toISOString()
      };
      data.quizzes[index] = updatedQuiz;
      fileUtils.atomicWriteFileSync(DB_FILE, JSON.stringify(data, null, 2));
      
      console.log('Updated quiz:', updatedQuiz);
      return updatedQuiz;
    } catch (error) {
      console.error('Error updating quiz:', error);
      throw error;
    }
  },
  
  // Delete a quiz
  async deleteQuiz(id) {
    try {
      const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      const index = data.quizzes.findIndex(quiz => quiz.id === parseInt(id, 10));
      
      if (index === -1) {
        throw new Error('Quiz not found');
      }
      
      data.quizzes.splice(index, 1);
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
      
      return true;
    } catch (error) {
      console.error('Error deleting quiz:', error);
      throw error;
    }
  }
};

module.exports = quizService;
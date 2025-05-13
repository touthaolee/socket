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
      
      // Make sure DB_FILE exists
      if (!fs.existsSync(DB_FILE)) {
        console.error('DB file does not exist:', DB_FILE);
        fs.writeFileSync(DB_FILE, JSON.stringify({ quizzes: [], nextId: 1 }, null, 2), 'utf8');
        console.log('Created new DB file');
      }
      
      let data;
      try {
        const fileContent = fs.readFileSync(DB_FILE, 'utf8');
        console.log('DB file read successfully, content length:', fileContent.length);
        console.log('DB file content preview:', fileContent.substring(0, 150) + '...');
        data = JSON.parse(fileContent);
        console.log('DB file parsed successfully, quiz count:', data.quizzes?.length || 0);
        
        // If there are no quizzes, create sample quizzes
        if (!data.quizzes || data.quizzes.length === 0) {
          console.log('No quizzes found. Creating sample quizzes...');
          const sampleQuizzes = await this.createSampleQuizzes();
          if (sampleQuizzes) {
            console.log('Sample quizzes created successfully');
            // Re-read the file to get the newly created quizzes
            data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
          }
        }
      } catch (readError) {
        console.error('Error reading/parsing DB file:', readError);
        // Recover by creating a new DB structure
        data = { quizzes: [], nextId: 1 };
      }
      
      // Validate data structure
      if (!data.quizzes || !Array.isArray(data.quizzes)) {
        console.error('Invalid data structure in quizzes.json, quizzes property is not an array');
        data = { quizzes: [], nextId: 1 };
      }
      
      // Add pagination support
      const startIndex = (page - 1) * limit;
      const endIndex = page * limit;
      const paginatedQuizzes = data.quizzes.slice(startIndex, endIndex);
      
      const totalPages = Math.ceil(data.quizzes.length / limit) || 1;
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
},  

// Create a new quiz
async createQuiz(quizData) {
    try {
      console.log('Creating quiz with data:', JSON.stringify(quizData, null, 2));
      
      // Verify we can read the database file
      if (!fs.existsSync(DB_FILE)) {
        console.error('DB file does not exist:', DB_FILE);
        fs.writeFileSync(DB_FILE, JSON.stringify({ quizzes: [], nextId: 1 }, null, 2), 'utf8');
        console.log('Created new DB file');
      }
      
      let data;
      try {
        const fileContent = fs.readFileSync(DB_FILE, 'utf8');
        console.log('DB file content:', fileContent.substring(0, 100) + '...');
        data = JSON.parse(fileContent);
      } catch (readError) {
        console.error('Error reading DB file:', readError);
        // Recover by creating a new DB structure
        data = { quizzes: [], nextId: 1 };
      }
      
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
      
      console.log('Adding new quiz to data:', newQuiz.id, newQuiz.title, newQuiz.status);
      data.quizzes.push(newQuiz);
      
      // Use atomic write to safely update the file
      try {
        fileUtils.atomicWriteFileSync(DB_FILE, JSON.stringify(data, null, 2));
        console.log('Successfully wrote DB file with new quiz');
      } catch (writeError) {
        console.error('Error writing DB file:', writeError);
        // Fallback to regular write if atomic write fails
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
        console.log('Used fallback method to write DB file');
      }
      
      console.log('Created new quiz:', newQuiz.id, newQuiz.title);
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
  },

  // Create sample quizzes if none exist
  async createSampleQuizzes() {
    try {
      console.log('Creating sample quizzes');
      
      // Sample quizzes data
      const sampleQuizzes = [
        {
          "title": "80's Music",
          "name": "80's Music",
          "description": "Common knowledge about 80's music for every fan",
          "timePerQuestion": 30,
          "status": "draft",
          "questions": [
            {
              "text": "Which Michael Jackson album featured 'Billie Jean' and 'Beat It'?",
              "options": [
                { "text": "Thriller", "isCorrect": true },
                { "text": "Bad", "isCorrect": false },
                { "text": "Off the Wall", "isCorrect": false },
                { "text": "Dangerous", "isCorrect": false }
              ]
            },
            {
              "text": "Which band had a hit with 'Sweet Child O' Mine' in 1988?",
              "options": [
                { "text": "Aerosmith", "isCorrect": false },
                { "text": "Guns N' Roses", "isCorrect": true },
                { "text": "Bon Jovi", "isCorrect": false },
                { "text": "Def Leppard", "isCorrect": false }
              ]
            },
            {
              "text": "Who sang 'Like a Virgin'?",
              "options": [
                { "text": "Cyndi Lauper", "isCorrect": false },
                { "text": "Madonna", "isCorrect": true },
                { "text": "Whitney Houston", "isCorrect": false },
                { "text": "Janet Jackson", "isCorrect": false }
              ]
            },
            {
              "text": "Which band had hit singles with 'Rio' and 'Hungry Like the Wolf'?",
              "options": [
                { "text": "The Cure", "isCorrect": false },
                { "text": "Duran Duran", "isCorrect": true },
                { "text": "INXS", "isCorrect": false },
                { "text": "Depeche Mode", "isCorrect": false }
              ]
            },
            {
              "text": "Which song was NOT a hit by Queen in the 80s?",
              "options": [
                { "text": "Radio Ga Ga", "isCorrect": false },
                { "text": "Another One Bites the Dust", "isCorrect": false },
                { "text": "Bohemian Rhapsody", "isCorrect": true },
                { "text": "I Want to Break Free", "isCorrect": false }
              ]
            }
          ],
          "createdBy": 1,
          "createdAt": new Date().toISOString()
        },
        {
          "title": "80's Music Facts",
          "name": "80's Music Facts",
          "description": "Popular 80's music facts",
          "timePerQuestion": 30,
          "status": "draft",
          "questions": [
            {
              "text": "Which 80s song holds the record for best-selling single of all time?",
              "options": [
                { "text": "Thriller", "isCorrect": false },
                { "text": "Like a Prayer", "isCorrect": false },
                { "text": "White Wedding", "isCorrect": false },
                { "text": "Candle in the Wind", "isCorrect": true }
              ]
            },
            {
              "text": "Which artist released 'Purple Rain' in 1984?",
              "options": [
                { "text": "Michael Jackson", "isCorrect": false },
                { "text": "Prince", "isCorrect": true },
                { "text": "David Bowie", "isCorrect": false },
                { "text": "Bruce Springsteen", "isCorrect": false }
              ]
            },
            {
              "text": "What was the name of Madonna's first UK number 1 single?",
              "options": [
                { "text": "Holiday", "isCorrect": false },
                { "text": "Into the Groove", "isCorrect": true },
                { "text": "Like a Virgin", "isCorrect": false },
                { "text": "Material Girl", "isCorrect": false }
              ]
            },
            {
              "text": "What year was Live Aid, featuring Queen, U2, and David Bowie?",
              "options": [
                { "text": "1984", "isCorrect": false },
                { "text": "1985", "isCorrect": true },
                { "text": "1986", "isCorrect": false },
                { "text": "1987", "isCorrect": false }
              ]
            },
            {
              "text": "Which of these songs was NOT released in the 1980s?",
              "options": [
                { "text": "Smells Like Teen Spirit", "isCorrect": true },
                { "text": "Every Breath You Take", "isCorrect": false },
                { "text": "Sweet Dreams (Are Made of This)", "isCorrect": false },
                { "text": "Take On Me", "isCorrect": false }
              ]
            }
          ],
          "createdBy": 1,
          "createdAt": new Date().toISOString()
        }
      ];
      
      console.log('Reading current data');
      
      // Read the current quiz file
      let data;
      try {
        data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      } catch (error) {
        console.error('Error reading DB file:', error);
        data = { quizzes: [], nextId: 1 };
      }
      
      let nextId = data.nextId || 1;
      
      // Add sample quizzes with proper IDs
      for (const quiz of sampleQuizzes) {
        quiz.id = nextId++;
      }
      
      // Update the quiz data
      data.quizzes = sampleQuizzes;
      data.nextId = nextId;
      
      // Write back to the file
      try {
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
        console.log('Sample quizzes saved to', DB_FILE);
        return true;
      } catch (saveError) {
        console.error('Error saving sample quizzes:', saveError);
        return false;
      }
    } catch (error) {
      console.error('Error creating sample quizzes:', error);
      return false;
    }
  },
};

module.exports = quizService;
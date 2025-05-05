/**
 * Interactive Quiz Application Project Setup
 * This script creates the initial project structure and files for an
 * interactive real-time quiz application using Express and Socket.io
 */
const fs = require('fs');
const path = require('path');

// Project directories to create
const directories = [
  'server-side',
  'server-side/server-api',
  'server-side/server-services',
  'server-side/server-socket',
  'client-side',
  'client-side/client-socket',
  'client-side/client-components',
  'client-side/client-utils',
  'shared',
  'config',
  'client-side/styles'
];

// Define file paths and their content
const files = {
  // Root files
  'AI-MANIFEST.md': 
`# AI-MANIFEST.md

## Project Overview
- **Project Name**: Interactive Quiz Application
- **Purpose**: Create an engaging real-time quiz platform with live participation
- **Target Audience**: Educators, trainers, and participants seeking interactive learning experiences
- **Business Goals**: Increase engagement, provide immediate feedback, and track learning progress
- **Success Metrics**: User participation rates, quiz completion rates, response accuracy

## Directory Structure
- \`server-side/\`: All server-side code
- \`client-side/\`: All client-side code
- \`shared/\`: Code shared between client and server
- \`config/\`: Application configuration

## Key Files
- \`server.js\`: Main server entry point
- \`server-side/server-main.js\`: Server initialization
- \`client-side/client-main.js\`: Client entry point`,

  'server.js': 
`/**
 * Main server entry point for Interactive Quiz Application
 */
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

// Import configuration
const config = require('./config/app-config');

// Import server initialization
const initServer = require('./server-side/server-main');

// Create Express app and HTTP server
const app = express();
const server = http.createServer(app);

// Initialize Socket.io
const io = new Server(server, {
  path: '/interac/socket.io',
  cors: {
    origin: "*", // Adjust for production
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(express.json());
app.use('/interac', express.static(path.join(__dirname, 'client-side')));

// Routes
app.get('/interac', (req, res) => {
  res.sendFile(path.join(__dirname, 'client-side', 'index.html'));
});

app.get('/interac/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'client-side', 'admin.html'));
});

// Initialize server with Express app and Socket.io instance
initServer(app, server, io);

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(\`Server running on port \${PORT}\`);
  console.log(\`Access the application at: http://localhost:\${PORT}/interac\`);
});`,

  'config/app-config.js': 
`/**
 * Application configuration
 */
module.exports = {
  // Server configuration
  PORT: process.env.PORT || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  
  // Authentication
  JWT_SECRET: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
  JWT_EXPIRY: '24h',
  
  // Application paths
  BASE_PATH: '/interac',
  
  // Quiz settings
  DEFAULT_TIME_LIMIT: 30, // seconds per question
  
  // Socket.io settings
  SOCKET_PATH: '/interac/socket.io',
  
  // CORS settings (for development)
  CORS_ORIGIN: '*'
};`,

  'server-side/server-main.js': 
`/**
 * Server initialization for Interactive Quiz Application
 */
const express = require('express');
const router = express.Router();

/**
 * Initialize server components
 * @param {Express} app - Express application
 * @param {Server} server - HTTP server
 * @param {SocketIO.Server} io - Socket.io server
 */
function initServer(app, server, io) {
  console.log('Initializing server components...');
  
  // Initialize API routes
  app.use('/interac/api/auth', router);
  app.use('/interac/api/quiz', router);
  
  // Initialize Socket.io connection
  io.on('connection', (socket) => {
    console.log('A user connected');
    
    socket.on('disconnect', () => {
      console.log('User disconnected');
    });
  });
  
  console.log('Server components initialized successfully');
}

module.exports = initServer;`,

  'shared/shared-constants.js': 
`/**
 * Shared constants between client and server
 */
const EVENTS = {
  // Connection events
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  
  // Authentication events
  AUTH_SUCCESS: 'auth:success',
  AUTH_ERROR: 'auth:error',
  
  // Quiz events
  JOIN_QUIZ: 'join_quiz',
  QUIZ_STATE: 'quiz_state',
  SUBMIT_ANSWER: 'submit_answer',
  ANSWER_RESULT: 'answer_result',
  QUIZ_END: 'quiz_end',
  
  // Admin events
  START_QUIZ: 'admin:start_quiz',
  END_QUIZ: 'admin:end_quiz',
  NEXT_QUESTION: 'admin:next_question'
};

// Error codes
const ERROR_CODES = {
  INVALID_AUTH: 'auth/invalid',
  SESSION_EXPIRED: 'auth/expired',
  PERMISSION_DENIED: 'auth/permission-denied',
  QUIZ_NOT_FOUND: 'quiz/not-found',
  QUIZ_ALREADY_STARTED: 'quiz/already-started',
  QUIZ_NOT_STARTED: 'quiz/not-started',
  ANSWER_INVALID: 'quiz/invalid-answer',
  ANSWER_DUPLICATE: 'quiz/duplicate-answer'
};

module.exports = {
  EVENTS,
  ERROR_CODES
};`,

  'client-side/index.html': 
`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Interactive Quiz Application</title>
  <link rel="stylesheet" href="styles/main.css">
  <script src="/interac/socket.io/socket.io.js"></script>
</head>
<body>
  <div class="app-container">
    <!-- Login View -->
    <div id="login-view" class="view">
      <div class="login-container">
        <h1>Interactive Quiz</h1>
        <form id="login-form">
          <div class="form-group">
            <label for="username">Username</label>
            <input type="text" id="username" name="username" required>
          </div>
          <div class="form-group">
            <label for="password">Password</label>
            <input type="password" id="password" name="password" required>
          </div>
          <button type="submit" class="btn btn-primary">Login</button>
        </form>
      </div>
    </div>

    <!-- Quiz Selection View -->
    <div id="quiz-selection-view" class="view hidden">
      <header>
        <h1>Available Quizzes</h1>
        <button id="logout-button" class="btn btn-outline">Logout</button>
      </header>
      <div id="quiz-list" class="quiz-list-container">
        <!-- Quiz cards will be inserted here -->
      </div>
    </div>

    <!-- Active Quiz View -->
    <div id="active-quiz-view" class="view hidden">
      <header>
        <h1 id="quiz-title">Quiz Title</h1>
        <div id="score-display" class="score">Score: 0</div>
      </header>
      <div id="question-container" class="question-container">
        <!-- Current question will be inserted here -->
      </div>
    </div>

    <!-- Results View -->
    <div id="results-view" class="view hidden">
      <header>
        <h1>Quiz Results</h1>
        <button id="back-to-quizzes" class="btn btn-outline">Back to Quizzes</button>
      </header>
      <div id="results-container" class="results-container">
        <!-- Results will be inserted here -->
      </div>
    </div>
  </div>

  <!-- Toast notifications -->
  <div id="toast-container" class="toast-container"></div>

  <!-- Scripts -->
  <script src="client-main.js"></script>
</body>
</html>`,

  'client-side/client-main.js': 
`/**
 * Client-side main entry point
 */
document.addEventListener('DOMContentLoaded', function() {
  // DOM Elements
  const loginView = document.getElementById('login-view');
  const quizSelectionView = document.getElementById('quiz-selection-view');
  const activeQuizView = document.getElementById('active-quiz-view');
  const resultsView = document.getElementById('results-view');
  const loginForm = document.getElementById('login-form');
  const quizList = document.getElementById('quiz-list');
  
  // Mock quiz data
  const quizzes = [
    {
      id: 'quiz1',
      title: 'JavaScript Fundamentals',
      description: 'Test your knowledge of JavaScript basics',
      timeLimit: 30,
      questionCount: 10
    },
    {
      id: 'quiz2',
      title: 'HTML and CSS',
      description: 'Test your knowledge of web design',
      timeLimit: 25,
      questionCount: 8
    },
    {
      id: 'quiz3',
      title: 'Node.js Basics',
      description: 'Learn about server-side JavaScript',
      timeLimit: 40,
      questionCount: 12
    }
  ];
  
  // Render quiz list
  function renderQuizList() {
    quizList.innerHTML = '';
    
    quizzes.forEach(quiz => {
      const quizCard = document.createElement('div');
      quizCard.className = 'quiz-card';
      quizCard.dataset.quizId = quiz.id;
      
      quizCard.innerHTML = 
        '<h3>' + quiz.title + '</h3>' +
        '<p>' + quiz.description + '</p>' +
        '<div class="quiz-meta">' +
          '<span class="quiz-time">Time: ' + quiz.timeLimit + ' sec</span>' +
          '<span class="quiz-questions">Questions: ' + quiz.questionCount + '</span>' +
        '</div>';
      
      quizCard.addEventListener('click', () => {
        console.log('Quiz selected:', quiz.id);
        // Here you would initialize the quiz
      });
      
      quizList.appendChild(quizCard);
    });
  }
  
  // Event Listeners
  loginForm.addEventListener('submit', function(e) {
    e.preventDefault();
    // Mock login
    loginView.classList.add('hidden');
    quizSelectionView.classList.remove('hidden');
    renderQuizList();
  });
  
  // Initialize
  console.log('Interactive Quiz Application initialized');
});`,

  'client-side/styles/main.css': 
`/* Main styles for Interactive Quiz Application */
:root {
  --primary-color: #2563eb;
  --primary-hover: #1d4ed8;
  --secondary-color: #64748b;
  --text-color: #1e293b;
  --background-color: #f8fafc;
  --error-color: #ef4444;
  --success-color: #10b981;
  --border-color: #e2e8f0;
  --shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  color: var(--text-color);
  background-color: var(--background-color);
  line-height: 1.5;
}

.app-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

/* Views */
.view {
  display: block;
}

.hidden {
  display: none;
}

/* Components */
.btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 0.25rem;
  cursor: pointer;
  font-weight: 500;
  transition: background-color 0.2s, transform 0.1s;
}

.btn:hover {
  transform: translateY(-1px);
}

.btn-primary {
  background-color: var(--primary-color);
  color: white;
}

.btn-primary:hover {
  background-color: var(--primary-hover);
}

.btn-outline {
  background-color: transparent;
  border: 1px solid var(--primary-color);
  color: var(--primary-color);
}

.btn-outline:hover {
  background-color: var(--primary-color);
  color: white;
}

/* Forms */
.form-group {
  margin-bottom: 1rem;
}

label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
}

input {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid var(--border-color);
  border-radius: 0.25rem;
}

/* Quiz Cards */
.quiz-list-container {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;
  margin-top: 2rem;
}

.quiz-card {
  background-color: white;
  border-radius: 0.5rem;
  padding: 1.5rem;
  box-shadow: var(--shadow);
  cursor: pointer;
  transition: transform 0.2s;
}

.quiz-card:hover {
  transform: translateY(-5px);
}

/* Question */
.question-container {
  background-color: white;
  border-radius: 0.5rem;
  padding: 2rem;
  box-shadow: var(--shadow);
  margin-top: 2rem;
}

.options-container {
  display: grid;
  gap: 1rem;
  margin-top: 1.5rem;
}

.option-button {
  padding: 1rem;
  background-color: white;
  border: 1px solid var(--border-color);
  border-radius: 0.25rem;
  cursor: pointer;
  text-align: left;
  transition: background-color 0.2s;
}

.option-button:hover {
  background-color: var(--border-color);
}

.option-correct {
  background-color: var(--success-color);
  color: white;
  border-color: var(--success-color);
}

.option-incorrect {
  background-color: var(--error-color);
  color: white;
  border-color: var(--error-color);
}

/* Toasts */
.toast-container {
  position: fixed;
  bottom: 1rem;
  right: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.toast {
  padding: 1rem;
  border-radius: 0.25rem;
  color: white;
  animation: fadeIn 0.3s, fadeOut 0.3s 2.7s;
  margin-top: 0.5rem;
  box-shadow: var(--shadow);
}

.toast-success {
  background-color: var(--success-color);
}

.toast-error {
  background-color: var(--error-color);
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes fadeOut {
  from { opacity: 1; transform: translateY(0); }
  to { opacity: 0; transform: translateY(-20px); }
}`
};

/**
 * Create a directory if it doesn't exist
 * @param {string} dir - Directory path
 */
function createDirectoryIfNotExists(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Created directory: ${dir}`);
  }
}

/**
 * Write file with content
 * @param {string} filePath - File path
 * @param {string} content - File content
 */
function writeFile(filePath, content) {
  try {
    const dir = path.dirname(filePath);
    createDirectoryIfNotExists(dir);
    
    fs.writeFileSync(filePath, content);
    console.log(`Created file: ${filePath}`);
  } catch (error) {
    console.error(`Error creating file ${filePath}:`, error);
  }
}

/**
 * Setup project structure
 */
function setupProject() {
  console.log('Setting up Interactive Quiz Application project structure...');
  
  // Create directories
  directories.forEach(dir => createDirectoryIfNotExists(dir));
  
  // Create files
  Object.entries(files).forEach(([filePath, content]) => {
    writeFile(filePath, content);
  });
  
  console.log('Project setup complete! 🚀');
  console.log('Run `npm install express socket.io jsonwebtoken uuid` to install dependencies');
  console.log('Then run `node server.js` to start the application');
}

// Run setup when script is executed directly
if (require.main === module) {
  setupProject();
}

module.exports = { setupProject };
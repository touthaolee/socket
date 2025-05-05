// setup-project.js
const fs = require('fs');
const path = require('path');

// Define file paths and their content
const structure = {
  'AI-MANIFEST.md': `# AI-MANIFEST.md

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
- \`client-side/client-main.js\`: Client entry point

## Implementation Plan

### 1. Server Core
- [ ] Basic Express setup
- [ ] Socket.io integration
- [ ] Session management

### 2. Authentication System
- [ ] JWT implementation
- [ ] Login/logout endpoints
- [ ] Token validation

### 3. Quiz Management
- [ ] Quiz data structure
- [ ] Participant tracking
- [ ] Question delivery
- [ ] Answer validation

### 4. Client Interface
- [ ] Login screen
- [ ] Quiz selection
- [ ] Active participation
- [ ] Results display

## Development Guidelines

1. Use explicit file naming with domain prefixes (server-, client-, shared-)
2. Implement comprehensive error handling at all boundaries
3. Include JSDoc comments for all public methods
4. Write tests for critical functionality

## Socket.io Event Protocol

| Event Name | Direction | Payload | Description |
|------------|-----------|---------|-------------|
| join_quiz  | Client→Server | \`{ quizId }\` | Join a specific quiz |
| quiz_state | Server→Client | \`{ status, currentQuestion, ... }\` | Current quiz state |
| submit_answer | Client→Server | \`{ quizId, questionId, answer }\` | Submit an answer |
| answer_result | Server→Client | \`{ correct, explanation, score }\` | Answer feedback |

## Data Structures

### Quiz
\`\`\`json
{
 "id": "string",
 "title": "string",
 "description": "string",
 "questions": [Question],
 "timeLimit": "number (seconds)"
}
\`\`\`

### Question
\`\`\`json
{
 "id": "string",
 "text": "string",
 "options": [{"id": "string", "text": "string"}],
 "correctOptionId": "string",
 "explanation": "string"
}
\`\`\`

## AI Collaboration Guidelines

When requesting AI assistance with this project:

1. **Specific Components**: Ask for complete implementations of specific components
2. **Context**: Provide information about how the component fits into the application
3. **Interfaces**: Clearly define the inputs, outputs, and dependencies
4. **Error Cases**: Specify how edge cases and errors should be handled

## Feature Roadmap

### Phase 1: Core Functionality
- User authentication
- Basic quiz creation
- Quiz participation
- Simple results display

### Phase 2: Enhanced Features
- Real-time participant tracking
- Advanced quiz types
- Detailed analytics
- Customizable themes

### Phase 3: Expansion
- Team competition mode
- Integration with learning management systems
- Mobile-optimized experience
- Offline support`,

  'server.js': `/**
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

  'server-side/server-main.js': `/**
* Server initialization for Interactive Quiz Application
*/
const socketHandlers = require('./server-socket/socket-handlers');
const apiAuth = require('./server-api/api-auth');
const apiQuiz = require('./server-api/api-quiz');

/**
* Initialize server components
* @param {Express} app - Express application
* @param {Server} server - HTTP server
* @param {SocketIO.Server} io - Socket.io server
*/
function initServer(app, server, io) {
 console.log('Initializing server components...');
 
 // Initialize API routes
 app.use('/interac/api/auth', apiAuth);
 app.use('/interac/api/quiz', apiQuiz);
 
 // Initialize Socket.io handlers
 socketHandlers.init(io);
 
 console.log('Server components initialized successfully');
}

module.exports = initServer;`,

  'server-side/server-socket/socket-events.js': `/**
* Socket.io event definitions
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

module.exports = EVENTS;`,

  'server-side/server-socket/socket-handlers.js': `/**
* Socket.io event handlers
*/
const EVENTS = require('./socket-events');
const authService = require('../server-services/auth-service');
const quizService = require('../server-services/quiz-service');

// Track connected clients
const connectedClients = new Map();

/**
* Initialize Socket.io handlers
* @param {SocketIO.Server} io - Socket.io server
*/
function init(io) {
 // Socket.io middleware for authentication
 io.use((socket, next) => {
   const token = socket.handshake.auth.token;
   if (!token) {
     return next(new Error('Authentication required'));
   }
   
   try {
     // Validate token
     const user = authService.validateToken(token);
     socket.user = user;
     next();
   } catch (error) {
     next(new Error('Invalid authentication'));
   }
 });
 
 // Connection handler
 io.on(EVENTS.CONNECT, (socket) => {
   console.log(\`User connected: \${socket.id}\`);
   
   // Store client connection
   connectedClients.set(socket.id, {
     userId: socket.user?.id,
     username: socket.user?.username,
     role: socket.user?.role
   });
   
   // Handle disconnect
   socket.on(EVENTS.DISCONNECT, () => {
     console.log(\`User disconnected: \${socket.id}\`);
     connectedClients.delete(socket.id);
   });
   
   // Setup event handlers
   setupEventHandlers(io, socket);
 });
}

/**
* Set up event handlers for a socket
* @param {SocketIO.Server} io - Socket.io server
* @param {SocketIO.Socket} socket - Socket instance
*/
function setupEventHandlers(io, socket) {
 // Join quiz
 socket.on(EVENTS.JOIN_QUIZ, (data) => {
   const { quizId } = data;
   console.log(\`User \${socket.user.username} joining quiz \${quizId}\`);
   
   try {
     // Join the quiz room
     socket.join(\`quiz:\${quizId}\`);
     
     // Get quiz state
     const quizState = quizService.getQuizState(quizId);
     
     // Send quiz state to the client
     socket.emit(EVENTS.QUIZ_STATE, quizState);
   } catch (error) {
     socket.emit(EVENTS.ERROR, {
       message: 'Failed to join quiz',
       details: error.message
     });
   }
 });
 
 // Submit answer
 socket.on(EVENTS.SUBMIT_ANSWER, (data) => {
   const { quizId, questionId, answer } = data;
   
   try {
     // Process the answer
     const result = quizService.processAnswer(quizId, socket.user.id, questionId, answer);
     
     // Send result back to the client
     socket.emit(EVENTS.ANSWER_RESULT, result);
   } catch (error) {
     socket.emit(EVENTS.ERROR, {
       message: 'Failed to process answer',
       details: error.message
     });
   }
 });
 
 // Admin: Start quiz
 socket.on(EVENTS.START_QUIZ, (data) => {
   // Check if user is an admin
   if (socket.user.role !== 'admin') {
     return socket.emit(EVENTS.ERROR, {
       message: 'Unauthorized'
     });
   }
   
   const { quizId } = data;
   
   try {
     // Start the quiz
     quizService.startQuiz(quizId);
     
     // Notify all clients in the quiz room
     io.to(\`quiz:\${quizId}\`).emit(EVENTS.QUIZ_STATE, quizService.getQuizState(quizId));
   } catch (error) {
     socket.emit(EVENTS.ERROR, {
       message: 'Failed to start quiz',
       details: error.message
     });
   }
 });
}

module.exports = {
 init
};`,

  'server-side/server-api/api-auth.js': `/**
* Authentication API endpoints
*/
const express = require('express');
const router = express.Router();
const authService = require('../server-services/auth-service');

/**
* Login endpoint
* POST /interac/api/auth/login
*/
router.post('/login', (req, res) => {
 try {
   const { username, password } = req.body;
   
   // Validate required fields
   if (!username || !password) {
     return res.status(400).json({
       success: false,
       message: 'Username and password are required'
     });
   }
   
   // Authenticate user
   const result = authService.authenticate(username, password);
   
   if (result.success) {
     res.json({
       success: true,
       token: result.token,
       user: result.user
     });
   } else {
     res.status(401).json({
       success: false,
       message: 'Invalid credentials'
     });
   }
 } catch (error) {
   res.status(500).json({
     success: false,
     message: 'Authentication failed',
     error: error.message
   });
 }
});

/**
* Logout endpoint
* POST /interac/api/auth/logout
*/
router.post('/logout', (req, res) => {
 // In JWT-based auth, client-side logout is sufficient
 // Server-side could implement token blacklisting if needed
 res.json({
   success: true,
   message: 'Logged out successfully'
 });
});

/**
* Verify token endpoint
* GET /interac/api/auth/verify
*/
router.get('/verify', (req, res) => {
 try {
   const token = req.headers.authorization?.split(' ')[1];
   
   if (!token) {
     return res.status(401).json({
       success: false,
       message: 'No token provided'
     });
   }
   
   // Validate token
   const user = authService.validateToken(token);
   
   res.json({
     success: true,
     user
   });
 } catch (error) {
   res.status(401).json({
     success: false,
     message: 'Invalid token',
     error: error.message
   });
 }
});

module.exports = router;`,

  'server-side/server-api/api-quiz.js': `/**
* Quiz API endpoints
*/
const express = require('express');
const router = express.Router();
const quizService = require('../server-services/quiz-service');
const authService = require('../server-services/auth-service');

// Authentication middleware
function authenticate(req, res, next) {
 try {
   const token = req.headers.authorization?.split(' ')[1];
   
   if (!token) {
     return res.status(401).json({
       success: false,
       message: 'Authentication required'
     });
   }
   
   // Validate token
   req.user = authService.validateToken(token);
   next();
 } catch (error) {
   res.status(401).json({
     success: false,
     message: 'Invalid token',
     error: error.message
   });
 }
}

// Admin role middleware
function requireAdmin(req, res, next) {
 if (req.user.role !== 'admin') {
   return res.status(403).json({
     success: false,
     message: 'Admin access required'
   });
 }
 next();
}

/**
* Get all quizzes
* GET /interac/api/quiz
*/
router.get('/', authenticate, (req, res) => {
 try {
   const quizzes = quizService.getQuizzes();
   res.json({
     success: true,
     quizzes
   });
 } catch (error) {
   res.status(500).json({
     success: false,
     message: 'Failed to fetch quizzes',
     error: error.message
   });
 }
});

/**
* Get quiz by ID
* GET /interac/api/quiz/:id
*/
router.get('/:id', authenticate, (req, res) => {
 try {
   const quiz = quizService.getQuizById(req.params.id);
   
   if (!quiz) {
     return res.status(404).json({
       success: false,
       message: 'Quiz not found'
     });
   }
   
   res.json({
     success: true,
     quiz
   });
 } catch (error) {
   res.status(500).json({
     success: false,
     message: 'Failed to fetch quiz',
     error: error.message
   });
 }
});

/**
* Create quiz
* POST /interac/api/quiz
*/
router.post('/', authenticate, requireAdmin, (req, res) => {
 try {
   const quiz = quizService.createQuiz(req.body);
   res.status(201).json({
     success: true,
     quiz
   });
 } catch (error) {
   res.status(500).json({
     success: false,
     message: 'Failed to create quiz',
     error: error.message
   });
 }
});

/**
* Update quiz
* PUT /interac/api/quiz/:id
*/
router.put('/:id', authenticate, requireAdmin, (req, res) => {
 try {
   const quiz = quizService.updateQuiz(req.params.id, req.body);
   res.json({
     success: true,
     quiz
   });
 } catch (error) {
   res.status(500).json({
     success: false,
     message: 'Failed to update quiz',
     error: error.message
   });
 }
});

/**
* Delete quiz
* DELETE /interac/api/quiz/:id
*/
router.delete('/:id', authenticate, requireAdmin, (req, res) => {
 try {
   quizService.deleteQuiz(req.params.id);
   res.json({
     success: true,
     message: 'Quiz deleted successfully'
   });
 } catch (error) {
   res.status(500).json({
     success: false,
     message: 'Failed to delete quiz',
     error: error.message
   });
 }
});

module.exports = router;`,

  'server-side/server-services/auth-service.js': `/**
* Authentication service
*/
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { JWT_SECRET, JWT_EXPIRY } = require('../../config/app-config');

// In-memory user store (replace with database in production)
const users = [
 {
   id: '1',
   username: 'admin',
   password: hashPassword('admin123'),
   role: 'admin'
 },
 {
   id: '2',
   username: 'user',
   password: hashPassword('user123'),
   role: 'user'
 }
];

/**
* Hash password using SHA-256
* @param {string} password - Plain text password
* @returns {string} Hashed password
*/
function hashPassword(password) {
 return crypto
   .createHash('sha256')
   .update(password)
   .digest('hex');
}

/**
* Authenticate user
* @param {string} username - Username
* @param {string} password - Password
* @returns {Object} Authentication result
*/
function authenticate(username, password) {
 // Find user
 const user = users.find(u => u.username === username);
 
 if (!user) {
   return {
     success: false,
     message: 'User not found'
   };
 }
 
 // Check password
 const hashedPassword = hashPassword(password);
 if (user.password !== hashedPassword) {
   return {
     success: false,
     message: 'Invalid password'
   };
 }
 
 // Generate token
 const token = generateToken(user);
 
 return {
   success: true,
   token,
   user: {
     id: user.id,
     username: user.username,
     role: user.role
   }
 };
}

/**
* Generate JWT token
* @param {Object} user - User object
* @returns {string} JWT token
*/
function generateToken(user) {
 const payload = {
   id: user.id,
   username: user.username,
   role: user.role
 };
 
 return jwt.sign(payload, JWT_SECRET, {
   expiresIn: JWT_EXPIRY
 });
}

/**
* Validate JWT token
* @param {string} token - JWT token
* @returns {Object} Decoded user
*/
function validateToken(token) {
 try {
   return jwt.verify(token, JWT_SECRET);
 } catch (error) {
   throw new Error('Invalid token');
 }
}

module.exports = {
 authenticate,
 validateToken,
 generateToken
};`,

  'server-side/server-services/quiz-service.js': `/**
* Quiz service
*/
const { v4: uuidv4 } = require('uuid');

// In-memory quiz store (replace with database in production)
const quizzes = [
 {
   id: '1',
   title: 'Sample Quiz',
   description: 'A sample quiz to demonstrate functionality',
   questions: [
     {
       id: '1',
       text: 'What is the capital of France?',
       options: [
         { id: 'a', text: 'London' },
         { id: 'b', text: 'Berlin' },
         { id: 'c', text: 'Paris' },
         { id: 'd', text: 'Madrid' }
       ],
       correctOptionId: 'c',
       explanation: 'Paris is the capital of France.'
     },
     {
       id: '2',
       text: 'What is 2 + 2?',
       options: [
         { id: 'a', text: '3' },
         { id: 'b', text: '4' },
         { id: 'c', text: '5' },
         { id: 'd', text: '6' }
       ],
       correctOptionId: 'b',
       explanation: '2 + 2 = 4'
     }
   ],
   timeLimit: 30
 }
];

// In-memory quiz sessions
const quizSessions = new Map();

/**
* Get all quizzes (without questions for security)
* @returns {Array} List of quizzes
*/
function getQuizzes() {
 return quizzes.map(quiz => ({
   id: quiz.id,
   title: quiz.title,
   description: quiz.description,
   questionCount: quiz.questions.length
 }));
}

/**
* Get quiz by ID
* @param {string} quizId - Quiz ID
* @returns {Object} Quiz object
*/
function getQuizById(quizId) {
 const quiz = quizzes.find(q => q.id === quizId);
 if (!quiz) {
   throw new Error('Quiz not found');
 }
 return quiz;
}

/**
* Create a new quiz
* @param {Object} quizData - Quiz data
* @returns {Object} Created quiz
*/
function createQuiz(quizData) {
 // Validate required fields
 if (!quizData.title || !quizData.questions || !Array.isArray(quizData.questions)) {
   throw new Error('Invalid quiz data');
 }
 
 // Create quiz with unique ID
 const newQuiz = {
   id: uuidv4(),
   title: quizData.title,
   description: quizData.description || '',
   questions: quizData.questions.map(q => ({
     id: uuidv4(),
     text: q.text,
     options: q.options,
     correctOptionId: q.correctOptionId,
     explanation: q.explanation || ''
   })),
   timeLimit: quizData.timeLimit || 30
 };
 
 quizzes.push(newQuiz);
 return newQuiz;
}

/**
* Update a quiz
* @param {string} quizId - Quiz ID
* @param {Object} quizData - Updated quiz data
* @returns {Object} Updated quiz
*/
function updateQuiz(quizId, quizData) {
 const index = quizzes.findIndex(q => q.id === quizId);
 if (index === -1) {
   throw new Error('Quiz not found');
 }
 
 // Update quiz properties
 quizzes[index] = {
   ...quizzes[index],
   ...quizData,
   id: quizId // Ensure ID doesn't change
 };
 
 return quizzes[index];
}

/**
* Delete a quiz
* @param {string} quizId - Quiz ID
*/
function deleteQuiz(quizId) {
 const index = quizzes.findIndex(q => q.id === quizId);
 if (index === -1) {
   throw new Error('Quiz not found');
 }
 
 quizzes.splice(index, 1);
}

/**
* Get quiz state
* @param {string} quizId - Quiz ID
* @returns {Object} Quiz state
*/
function getQuizState(quizId) {
 // Get quiz
 const quiz = getQuizById(quizId);
 
 // Get or create session
 if (!quizSessions.has(quizId)) {
   quizSessions.set(quizId, {
     quizId,
     status: 'waiting',
     currentQuestionIndex: 0,
     participants: {},
     startTime: null,
     endTime: null
   });
 }
 
 const session = quizSessions.get(quizId);
 
 // If active, include current question
 if (session.status === 'active') {
   return {
     ...session,
     currentQuestion: quiz.questions[session.currentQuestionIndex],
     totalQuestions: quiz.questions.length
   };
 }
 
 return session;
}

/**
* Start a quiz
* @param {string} quizId - Quiz ID
*/
function startQuiz(quizId) {
 // Verify quiz exists
 getQuizById(quizId);
 
 // Get or create session
 if (!quizSessions.has(quizId)) {
   quizSessions.set(quizId, {
     quizId,
     status: 'waiting',
     currentQuestionIndex: 0,
     participants: {},
     startTime: null,
     endTime: null
   });
 }
 
 const session = quizSessions.get(quizId);
 
 // Update session
 session.status = 'active';
 session.startTime = new Date();
 session.currentQuestionIndex = 0;
 
 quizSessions.set(quizId, session);
}

/**
* Process an answer
* @param {string} quizId - Quiz ID
* @param {string} userId - User ID
* @param {string} questionId - Question ID
* @param {string} answerId - Answer ID
* @returns {Object} Answer result
*/
function processAnswer(quizId, userId, questionId, answerId) {
 // Get quiz
 const quiz = getQuizById(quizId);
 
 // Get session
 if (!quizSessions.has(quizId)) {
   throw new Error('Quiz session not found');
 }
 
 const session = quizSessions.get(quizId);
 
 // Verify quiz is active
 if (session.status !== 'active') {
   throw new Error('Quiz is not active');
 }
 
 // Find question
 const question = quiz.questions.find(q => q.id === questionId);
 if (!question) {
   throw new Error('Question not found');
 }
 
 // Initialize participant if not exists
 if (!session.participants[userId]) {
   session.participants[userId] = {
     score: 0,
     answers: {}
   };
 }
 
 // Prevent duplicate answers
 if (session.participants[userId].answers[questionId]) {
   throw new Error('Question already answered');
 }
 
 // Check answer
 const isCorrect = question.correctOptionId === answerId;
 
 // Update score (10 points for correct answer)
 if (isCorrect) {
   session.participants[userId].score += 10;
 }
 
 // Record answer
 session.participants[userId].answers[questionId] = {
   answerId,
   isCorrect
 };
 
 // Update session
 quizSessions.set(quizId, session);
 
 // Return result
 return {
   isCorrect,
   correctOptionId: question.correctOptionId,
   explanation: question.explanation,
   score: session.participants[userId].score
 };
}

/**
* End a quiz
* @param {string} quizId - Quiz ID
* @returns {Object} Quiz results
*/
function endQuiz(quizId) {
 // Get session
 if (!quizSessions.has(quizId)) {
   throw new Error('Quiz session not found');
 }
 
 const session = quizSessions.get(quizId);
 
 // Update session
 session.status = 'completed';
 session.endTime = new Date();
 
 quizSessions.set(quizId, session);
 
 // Calculate results
 const results = {
   quizId,
   startTime: session.startTime,
   endTime: session.endTime,
   participants: Object.entries(session.participants).map(([userId, data]) => ({
     userId,
     score: data.score,
     correctAnswers: Object.values(data.answers).filter(a => a.isCorrect).length
   }))
 };
 
 // Sort by score (descending)
 results.participants.sort((a, b) => b.score - a.score);
 
 return results;
}

module.exports = {
 getQuizzes,
 getQuizById,
 createQuiz,
 updateQuiz,
 deleteQuiz,
 getQuizState,
 startQuiz,
 processAnswer,
 endQuiz
};`,

  'client-side/client-main.js': `/**
* Client-side main entry point
*/
import { EVENTS } from '../shared/shared-constants.js';
import { initSocket } from './client-socket/socket-client.js';
import { showToast, showView } from './client-utils/client-helpers.js';

// App state
let socket;
let currentUser;
let currentQuiz;
let currentQuestion;

/**
* Initialize the application
*/
document.addEventListener('DOMContentLoaded', () => {
 console.log('Client application initializing...');
 
 // Check for existing session
 const token = localStorage.getItem('authToken');
 const userData = localStorage.getItem('userData');
 
 if (token && userData) {
   try {
     // Parse user data
     currentUser = JSON.parse(userData);
     
     // Initialize Socket.io connection
     initializeSocket(token);
     
     // Show quiz selection view
     showView('quiz-selection-view');
     
     // Load available quizzes
     loadQuizzes();
   } catch (error) {
     console.error('Error restoring session:', error);
     showView('login-view');
   }
 } else {
   showView('login-view');
 }
 
 // Set up event listeners
 setupEventListeners();
});

/**
* Initialize Socket.io connection
* @param {string} token - Authentication token
*/
function initializeSocket(token) {
 socket = initSocket(token);
 
 // Set up Socket.io event handlers
 socket.on(EVENTS.CONNECT, () => {
   console.log('Connected to server');
   showToast('Connected to server', 'success');
 });
 
 socket.on(EVENTS.DISCONNECT, () => {
   console.log('Disconnected from server');
   showToast('Disconnected from server', 'error');
 });
 
 socket.on(EVENTS.AUTH_SUCCESS, (data) => {
   console.log('Authentication successful');
 });
 
 socket.on(EVENTS.AUTH_ERROR, (error) => {
   console.error('Authentication error:', error);
   showToast('Authentication error: ' + error.message, 'error');
   logout();
 });
 
 socket.on(EVENTS.QUIZ_STATE, handleQuizState);
 socket.on(EVENTS.ANSWER_RESULT, handleAnswerResult);
}

/**
* Set up event listeners
*/
function setupEventListeners() {
 // Login form
 const loginForm = document.getElementById('login-form');
 loginForm.addEventListener('submit', async (e) => {
   e.preventDefault();
   
   const username = loginForm.username.value;
   const password = loginForm.password.value;
   
   try {
     // Perform login
     const response = await fetch('/interac/api/auth/login', {
       method: 'POST',
       headers: {
         'Content-Type': 'application/json'
       },
       body: JSON.stringify({ username, password })
     });
     
     const data = await response.json();
     
     if (data.success) {
       // Save token and user data
       localStorage.setItem('authToken', data.token);
       localStorage.setItem('userData', JSON.stringify(data.user));
       
       // Initialize socket connection
       initializeSocket(data.token);
       
       // Show quiz selection view
       showView('quiz-selection-view');
       
       // Load available quizzes
       loadQuizzes();
     } else {
       showToast(data.message, 'error');
     }
   } catch (error) {
     console.error('Login error:', error);
     showToast('Login failed. Please try again.', 'error');
   }
 });
 
 // Logout button
 const logoutButton = document.getElementById('logout-button');
 if (logoutButton) {
   logoutButton.addEventListener('click', () => {
     // Remove token and user data
     localStorage.removeItem('authToken');
     localStorage.removeItem('userData');
     
     // Disconnect socket
     if (socket) {
       socket.disconnect();
     }
     
     // Show login view
     showView('login-view');
   });
 }
 
 // Quiz selection
 const quizList = document.getElementById('quiz-list');
 quizList.addEventListener('click', (e) => {
   const quizId = e.target.closest('.quiz-card')?.dataset.quizId;
   if (quizId) {
     joinQuiz(quizId);
   }
 });
 
 // Back to quizzes button
 const backToQuizzesButton = document.getElementById('back-to-quizzes');
 if (backToQuizzesButton) {
   backToQuizzesButton.addEventListener('click', () => {
     showView('quiz-selection-view');
   });
 }
}

/**
* Join a quiz
* @param {string} quizId - Quiz ID
*/
function joinQuiz(quizId) {
 currentQuiz = quizId;
 
 // Join quiz room via Socket.io
 socket.emit(EVENTS.JOIN_QUIZ, { quizId });
}

/**
* Load available quizzes
*/
function loadQuizzes() {
 fetch('/interac/api/quiz')
   .then(response => response.json())
   .then(data => {
     if (data.success) {
       renderQuizList(data.quizzes);
     } else {
       showToast('Failed to load quizzes', 'error');
     }
   })
   .catch(error => {
     console.error('Error loading quizzes:', error);
     showToast('Error loading quizzes', 'error');
   });
}

/**
* Render quiz list
* @param {Array} quizzes - List of quizzes
*/
function renderQuizList(quizzes) {
 const quizList = document.getElementById('quiz-list');
 quizList.innerHTML = '';
 
 quizzes.forEach(quiz => {
   const quizCard = document.createElement('div');
   quizCard.className = 'quiz-card';
   quizCard.dataset.quizId = quiz.id;
   quizCard.innerHTML = `
     <h3>${quiz.title}</h3>
     <p>${quiz.description}</p>
     <div class="quiz-meta">
       <span class="quiz-time">Time: ${quiz.timeLimit} sec</span>
       <span class="quiz-questions">Questions: ${quiz.questionCount}</span>
     </div>
   `;
   
   // Add click listener to join quiz
   quizCard.addEventListener('click', () => {
     joinQuiz(quiz.id);
   });
   
   quizList.appendChild(quizCard);
 });
}

/**
* Handle quiz state update
* @param {Object} state - Quiz state
*/
function handleQuizState(state) {
 if (state.status === 'active') {
   // Show active quiz view
   showView('active-quiz-view');
   currentQuestion = 0;
   
   // Load first question
   loadQuestion(state.currentQuestion);
 } else if (state.status === 'completed') {
   // Show results view
   showView('results-view');
   loadResults(state.participants);
 }
}

/**
* Load a question
* @param {Object} question - Question data
*/
function loadQuestion(question) {
 const questionContainer = document.getElementById('question-container');
 
 // Render question component
 renderQuestion(questionContainer, question, handleAnswerSubmit);
}

/**
* Handle answer submission
* @param {string} answerId - Selected answer ID
*/
function handleAnswerSubmit(answerId) {
 // Submit answer via Socket.io
 socket.emit(EVENTS.SUBMIT_ANSWER, {
   quizId: currentQuiz,
   questionId: currentQuestion.id,
   answer: answerId
 });
}

/**
* Handle answer result
* @param {Object} result - Answer result
*/
function handleAnswerResult(result) {
 const questionContainer = document.getElementById('question-container');
 
 // Show feedback for the answer
 showFeedback(questionContainer, result);
 
 // Update score display
 const scoreDisplay = document.getElementById('score-display');
 scoreDisplay.textContent = 'Score: ' + result.score;
 
 // Load next question after a delay
 setTimeout(() => {
   currentQuestion++;
   
   // Check if there are more questions
   if (currentQuestion < currentQuiz.questions.length) {
     loadQuestion(currentQuiz.questions[currentQuestion]);
   } else {
     // No more questions, show results
     socket.emit(EVENTS.QUIZ_END, { quizId: currentQuiz });
   }
 }, 3000);
}

/**
* Load quiz results
* @param {Array} participants - List of participants
*/
function loadResults(participants) {
 const resultsContainer = document.getElementById('results-container');
 resultsContainer.innerHTML = '';
 
 participants.forEach(participant => {
   const resultItem = document.createElement('div');
   resultItem.className = 'result-item';
   resultItem.innerHTML = `
     <span class="result-username">${participant.username}</span>
     <span class="result-score">${participant.score} points</span>
   `;
   
   resultsContainer.appendChild(resultItem);
 });
}
`,

  'client-side/client-socket/socket-client.js': `/**
 * Socket.io client implementation
 */
import { EVENTS } from '../../shared/shared-constants.js';

/**
 * Initialize Socket.io connection
 * @param {string} token - Authentication token
 * @returns {Socket} Socket.io client instance
 */
export function initSocket(token) {
  // Connect to Socket.io server
  const socket = io({
    path: '/interac/socket.io',
    auth: { token },
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000
  });

  // Set up basic event logging
  socket.on('connect', () => {
    console.log('Socket connected with ID:', socket.id);
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected');
  });

  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });

  return socket;
}

/**
 * Emit an event with automatic reconnection support
 * @param {Socket} socket - Socket.io client instance
 * @param {string} event - Event name
 * @param {any} data - Event data
 * @param {Function} callback - Callback function
 * @returns {boolean} Success status
 */
export function safeEmit(socket, event, data, callback) {
  if (!socket || !socket.connected) {
    console.warn('Cannot emit event, socket not connected:', event);
    return false;
  }

  try {
    socket.emit(event, data, callback);
    return true;
  } catch (error) {
    console.error('Error emitting event:', error);
    return false;
  }
}`,

  'client-side/client-components/quiz-question.js': `/**
 * Quiz question component
 */

/**
 * Render a quiz question
 * @param {HTMLElement} container - Container element
 * @param {Object} question - Question data
 * @param {Function} onAnswerSubmit - Answer submission callback
 */
export function renderQuestion(container, question, onAnswerSubmit) {
  if (!container || !question) return;
  
  // Clear container
  container.innerHTML = '';
  
  // Create question element
  const questionElement = document.createElement('div');
  questionElement.className = 'question';
  
  // Add question text
  const questionText = document.createElement('h3');
  questionText.className = 'question-text';
  questionText.textContent = question.text;
  questionElement.appendChild(questionText);
  
  // Create options container
  const optionsContainer = document.createElement('div');
  optionsContainer.className = 'options-container';
  
  // Add options
  question.options.forEach(option => {
    const optionButton = document.createElement('button');
    optionButton.className = 'option-button';
    optionButton.textContent = option.text;
    optionButton.setAttribute('data-option-id', option.id);
    
    // Add click handler
    optionButton.addEventListener('click', () => {
      // Remove selected class from all options
      document.querySelectorAll('.option-button').forEach(btn => {
        btn.classList.remove('selected');
      });
      
      // Add selected class to clicked option
      optionButton.classList.add('selected');
      
      // Call answer submission callback
      onAnswerSubmit(option.id);
    });
    
    optionsContainer.appendChild(optionButton);
  });
  
  questionElement.appendChild(optionsContainer);
  
  // Add to container
  container.appendChild(questionElement);
  
  return {
    questionElement,
    optionsContainer
  };
}

/**
 * Update question display with answer feedback
 * @param {HTMLElement} container - Container element
 * @param {Object} result - Answer result
 */
export function showFeedback(container, result) {
  if (!container || !result) return;
  
  const { isCorrect, correctOptionId, explanation } = result;
  
  // Find all option buttons
  const optionButtons = container.querySelectorAll('.option-button');
  
  // Update option button classes
  optionButtons.forEach(button => {
    const optionId = button.getAttribute('data-option-id');
    
    if (optionId === correctOptionId) {
      button.classList.add('correct');
    } else if (button.classList.contains('selected') && !isCorrect) {
      button.classList.add('incorrect');
    }
    
    // Disable all buttons
    button.disabled = true;
  });
  
  // Create feedback element
  const feedbackElement = document.createElement('div');
  feedbackElement.className = \`feedback \${result.isCorrect ? 'correct' : 'incorrect'}\`;
  
  // Add feedback header
  const feedbackHeader = document.createElement('h4');
  feedbackHeader.textContent = isCorrect ? 'Correct!' : 'Incorrect';
  feedbackElement.appendChild(feedbackHeader);
  
  // Add explanation
  if (explanation) {
    const explanationElement = document.createElement('p');
    explanationElement.textContent = explanation;
    feedbackElement.appendChild(explanationElement);
  }
  
  // Add to container
  container.appendChild(feedbackElement);
}`,

  'client-side/client-components/quiz-results.js': `/**
 * Quiz results component
 */

/**
 * Render quiz results
 * @param {HTMLElement} container - Container element
 * @param {Object} results - Quiz results
 */
export function renderResults(container, results) {
  if (!container || !results) return;
  
  // Clear container
  container.innerHTML = '';
  
  // Create results element
  const resultsElement = document.createElement('div');
  resultsElement.className = 'quiz-results';
  
  // Add header
  const header = document.createElement('h3');
  header.textContent = 'Quiz Results';
  resultsElement.appendChild(header);
  
  // Add score
  const scoreElement = document.createElement('div');
  scoreElement.className = 'result-score';
  scoreElement.innerHTML = \`
    <p>Your score: <strong>\${results.score || 0}</strong></p>
    <p>Correct answers: <strong>\${results.correctAnswers || 0}</strong> / <strong>\${results.totalQuestions || 0}</strong></p>
  \`;
  resultsElement.appendChild(scoreElement);
  
  // Add leaderboard if participants exist
  if (results.participants && results.participants.length > 0) {
    const leaderboardElement = document.createElement('div');
    leaderboardElement.className = 'leaderboard';
    
    // Add leaderboard header
    const leaderboardHeader = document.createElement('h4');
    leaderboardHeader.textContent = 'Leaderboard';
    leaderboardElement.appendChild(leaderboardHeader);
    
    // Create table
    const table = document.createElement('table');
    table.className = 'leaderboard-table';
    
    // Add header row
    const headerRow = document.createElement('tr');
    headerRow.innerHTML = \`
      <th>Rank</th>
      <th>Player</th>
      <th>Score</th>
      <th>Correct</th>
    \`;
    table.appendChild(headerRow);
    
    // Add participant rows
    results.participants.forEach((participant, index) => {
      const row = document.createElement('tr');
      
      // Highlight current user
      if (participant.userId === results.currentUserId) {
        row.className = 'current-user';
      }
      
      row.innerHTML = \`
        <td>\${index + 1}</td>
        <td>\${participant.username}</td>
        <td>\${participant.score}</td>
        <td>\${participant.correctAnswers}</td>
      \`;
      
      table.appendChild(row);
    });
    
    leaderboardElement.appendChild(table);
    resultsElement.appendChild(leaderboardElement);
  }
  
  // Add to container
  container.appendChild(resultsElement);
}`,

  'client-side/client-styles/client-styles.css': `/**
 * Main stylesheet for Interactive Quiz Application
 */

/* Variables */
:root {
  --primary-color: #3498db;
  --secondary-color: #2ecc71;
  --danger-color: #e74c3c;
  --warning-color: #f39c12;
  --light-color: #f5f5f5;
  --dark-color: #333333;
  --border-radius: 4px;
  --box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
  --transition: all 0.3s ease;
}

/* Global styles */
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  line-height: 1.6;
  color: var(--dark-color);
  background-color: var(--light-color);
  padding: 20px;
}

h1, h2, h3, h4, h5, h6 {
  margin-bottom: 15px;
}

a {
  color: var(--primary-color);
  text-decoration: none;
}

a:hover {
  text-decoration: underline;
}

button {
  cursor: pointer;
}

/* App container */
#app {
  max-width: 1200px;
  margin: 0 auto;
  background-color: white;
  padding: 20px;
  border-radius: var(--border-radius);
  box-shadow: var(--box-shadow);
}

/* Header */
.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 20px;
  border-bottom: 1px solid #eee;
}

#user-info {
  display: flex;
  align-items: center;
}

/* Login form */
.login-container {
  max-width: 400px;
  margin: 0 auto;
  padding: 20px;
  background-color: white;
  border-radius: var(--border-radius);
  box-shadow: var(--box-shadow);
}

.form-group {
  margin-bottom: 15px;
}

.form-group label {
  display: block;
  margin-bottom: 5px;
  font-weight: bold;
}

.form-group input {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: var(--border-radius);
}

/* Buttons */
.btn {
  display: inline-block;
  padding: 10px 15px;
  background-color: var(--primary-color);
  color: white;
  border: none;
  border-radius: var(--border-radius);
  cursor: pointer;
  transition: var(--transition);
}

.btn:hover {
  opacity: 0.9;
}

.btn-primary {
  background-color: var(--primary-color);
}

.btn-secondary {
  background-color: #6c757d;
}

.btn-success {
  background-color: var(--secondary-color);
}

.btn-danger {
  background-color: var(--danger-color);
}

.btn-small {
  padding: 5px 10px;
  font-size: 0.9em;
}

/* Quiz list */
.quiz-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}

.quiz-card {
  background-color: white;
  border-radius: var(--border-radius);
  box-shadow: var(--box-shadow);
  padding: 20px;
  transition: var(--transition);
}

.quiz-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
}

.quiz-card h3 {
  margin-bottom: 10px;
}

/* Question styles */
.question {
  margin-bottom: 20px;
}

.question-text {
  font-size: 1.5em;
  margin-bottom: 20px;
}

.options-container {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.option-button {
  padding: 15px;
  background-color: white;
  border: 1px solid #ddd;
  border-radius: var(--border-radius);
  text-align: left;
  font-size: 1em;
  transition: var(--transition);
}

.option-button:hover {
  background-color: #f9f9f9;
  border-color: #ccc;
}

.option-button.selected {
  border-color: var(--primary-color);
  box-shadow: 0 0 0 2px rgba(52, 152, 219, 0.3);
}

.option-button.correct {
  border-color: var(--secondary-color);
  background-color: rgba(46, 204, 113, 0.1);
}

.option-button.incorrect {
  border-color: var(--danger-color);
  background-color: rgba(231, 76, 60, 0.1);
}

/* Feedback */
.feedback {
  margin-top: 20px;
  padding: 15px;
  border-radius: var(--border-radius);
}

.feedback.correct {
  background-color: rgba(46, 204, 113, 0.1);
  border-left: 4px solid var(--secondary-color);
}

.feedback.incorrect {
  background-color: rgba(231, 76, 60, 0.1);
  border-left: 4px solid var(--danger-color);
}

/* Results */
.quiz-results {
  background-color: white;
  border-radius: var(--border-radius);
  padding: 20px;
  margin-bottom: 20px;
}

.result-score {
  margin-bottom: 20px;
}

.leaderboard-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 10px;
}

.leaderboard-table th,
.leaderboard-table td {
  padding: 10px;
  border-bottom: 1px solid #eee;
  text-align: left;
}

.leaderboard-table th {
  background-color: #f9f9f9;
}

.leaderboard-table tr.current-user {
  background-color: rgba(52, 152, 219, 0.1);
  font-weight: bold;
}

/* Toast notifications */
.toast-container {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 1000;
}

.toast {
  padding: 10px 15px;
  margin-bottom: 10px;
  border-radius: var(--border-radius);
  background-color: white;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  animation: slide-in 0.3s ease;
}

.toast.success {
  border-left: 4px solid var(--secondary-color);
}

.toast.error {
  border-left: 4px solid var(--danger-color);
}

.toast.warning {
  border-left: 4px solid var(--warning-color);
}

.toast.info {
  border-left: 4px solid var(--primary-color);
}

@keyframes slide-in {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

/* Responsive design */
@media (max-width: 768px) {
  .quiz-list {
    grid-template-columns: 1fr;
  }
  
  .app-header {
    flex-direction: column;
    align-items: flex-start;
  }
  
  #user-info {
    margin-top: 10px;
  }
}`,

  'client-side/client-utils/client-helpers.js': `/**
 * Client utility functions
 */

/**
 * Show a toast notification
 * @param {string} message - Notification message
 * @param {string} type - Notification type (success, error, warning, info)
 * @param {number} duration - Duration in milliseconds
 */
export function showToast(message, type = 'info', duration = 3000) {
  // Create toast container if it doesn't exist
  let toastContainer = document.querySelector('.toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    document.body.appendChild(toastContainer);
  }
  
  // Create toast element
  const toast = document.createElement('div');
  toast.className = \`toast \${type}\`;
  toast.textContent = message;
  
  // Add to container
  toastContainer.appendChild(toast);
  
  // Remove after duration
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    
    // Remove from DOM after animation
    setTimeout(() => {
      toastContainer.removeChild(toast);
      
      // Remove container if empty
      if (toastContainer.children.length === 0) {
        document.body.removeChild(toastContainer);
      }
    }, 300);
  }, duration);
}

/**
 * Show a specific view and hide others
 * @param {string} viewId - View ID to show
 */
export function showView(viewId) {
  // Hide all views
  document.querySelectorAll('.app-view').forEach(view => {
    view.style.display = 'none';
  });
  
  // Show requested view
  const view = document.getElementById(viewId);
  if (view) {
    view.style.display = 'block';
  }
}

/**
 * Format date
 * @param {Date|string} date - Date to format
 * @returns {string} Formatted date
 */
export function formatDate(date) {
  const d = new Date(date);
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
}

/**
 * Sanitize HTML to prevent XSS
 * @param {string} html - HTML string to sanitize
 * @returns {string} Sanitized HTML
 */
export function sanitizeHtml(html) {
  const temp = document.createElement('div');
  temp.textContent = html;
  return temp.innerHTML;
}

/**
 * Debounce function for performance optimization
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
export function debounce(func, wait = 300) {
  let timeout;
  
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}`,

  'shared/shared-constants.js': `/**
 * Shared constants for client and server
 */

/**
 * Socket.io event types
 */
export const EVENTS = {
  // Connection events
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  ERROR: 'error',
  
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

/**
 * Quiz status types
 */
export const QUIZ_STATUS = {
  WAITING: 'waiting',
  ACTIVE: 'active',
  COMPLETED: 'completed'
};

/**
 * User roles
 */
export const USER_ROLES = {
  ADMIN: 'admin',
  USER: 'user'
};`,

  'shared/shared-types.js': `/**
 * Type definitions for InteractQuiz application
 */

/**
 * @typedef {Object} User
 * @property {string} id - User ID
 * @property {string} username - Username
 * @property {string} role - User role ('admin' or 'user')
 */

/**
 * @typedef {Object} Quiz
 * @property {string} id - Quiz ID
 * @property {string} title - Quiz title
 * @property {string} description - Quiz description
 * @property {Array<Question>} questions - Quiz questions
 * @property {number} timeLimit - Time limit per question in seconds
 */

/**
 * @typedef {Object} Question
 * @property {string} id - Question ID
 * @property {string} text - Question text
 * @property {Array<Option>} options - Answer options
 * @property {string} correctOptionId - Correct option ID
 * @property {string} explanation - Explanation for the correct answer
 */

/**
 * @typedef {Object} Option
 * @property {string} id - Option ID
 * @property {string} text - Option text
 */

/**
 * @typedef {Object} QuizSession
 * @property {string} quizId - Quiz ID
 * @property {string} status - Session status ('waiting', 'active', 'completed')
 * @property {number} currentQuestionIndex - Current question index
 * @property {Object} participants - Participant data by user ID
 * @property {Date} startTime - Quiz start time
 * @property {Date} endTime - Quiz end time
 */

/**
 * @typedef {Object} ParticipantData
 * @property {number} score - Participant score
 * @property {Object} answers - Answers by question ID
 */

/**
 * @typedef {Object} AnswerResult
 * @property {boolean} isCorrect - Whether answer is correct
 * @property {string} correctOptionId - Correct option ID
 * @property {string} explanation - Explanation for the correct answer
 * @property {number} score - Updated score
 */

/**
 * @typedef {Object} QuizState
 * @property {string} quizId - Quiz ID
 * @property {string} status - Quiz status
 * @property {Question} currentQuestion - Current question (if active)
 * @property {number} currentQuestionIndex - Current question index
 * @property {number} totalQuestions - Total number of questions
 * @property {Object} participants - Participant data
 */

/**
 * @typedef {Object} QuizResults
 * @property {string} quizId - Quiz ID
 * @property {Date} startTime - Quiz start time
 * @property {Date} endTime - Quiz end time
 * @property {Array<ParticipantResult>} participants - Participant results
 */

/**
 * @typedef {Object} ParticipantResult
 * @property {string} userId - User ID
 * @property {string} username - Username
 * @property {number} score - Final score
 * @property {number} correctAnswers - Number of correct answers
 */`,

  'shared/shared-utils.js': `/**
 * Shared utility functions for client and server
 */

/**
 * Generate a random ID
 * @param {number} length - ID length
 * @returns {string} Random ID
 */
export function generateId(length = 8) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Validate quiz data
 * @param {Object} quiz - Quiz data
 * @returns {boolean} Whether quiz is valid
 */
export function validateQuiz(quiz) {
  // Check required fields
  if (!quiz.title || !quiz.questions || !Array.isArray(quiz.questions)) {
    return false;
  }
  
  // Check questions
  for (const question of quiz.questions) {
    // Check required question fields
    if (!question.text || !question.options || !Array.isArray(question.options) || !question.correctOptionId) {
      return false;
    }
    
    // Check options
    if (question.options.length < 2) {
      return false;
    }
    
    // Check correct option exists
    if (!question.options.some(option => option.id === question.correctOptionId)) {
      return false;
    }
  }
  
  return true;
}

/**
 * Deep clone an object
 * @param {Object} obj - Object to clone
 * @returns {Object} Cloned object
 */
export function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Calculate time remaining
 * @param {Date} endTime - End time
 * @returns {number} Time remaining in seconds
 */
export function calculateTimeRemaining(endTime) {
  const now = new Date();
  const end = new Date(endTime);
  const diff = end - now;
  
  return Math.max(0, Math.floor(diff / 1000));
}`,

  'config/app-config.js': `/**
 * Application configuration
 */

module.exports = {
  // Server configuration
  PORT: process.env.PORT || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  
  // Security
  JWT_SECRET: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
  JWT_EXPIRY: '24h',
  
  // Quiz settings
  DEFAULT_TIME_LIMIT: 30, // seconds per question
  MAX_PARTICIPANTS: 100,
  
  // Socket.io settings
  SOCKET_PING_INTERVAL: 10000,
  SOCKET_PING_TIMEOUT: 5000,
  
  // Paths
  PUBLIC_PATH: 'client-side',
  API_PREFIX: '/interac/api'
};`,

  'client-side/index.html': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Interactive Quiz</title>
  <link rel="stylesheet" href="client-styles/client-styles.css">
</head>
<body>
  <div id="app">
    <header class="app-header">
      <h1>Interactive Quiz</h1>
      <div id="user-info"></div>
    </header>
    
    <!-- Login View -->
    <section id="login-view" class="app-view">
      <div class="login-container">
        <h2>Login to Participate</h2>
        <form id="login-form">
          <div class="form-group">
            <label for="username">Username</label>
            <input type="text" id="username" name="username" required>
          </div>
          <div class="form-group">
            <label for="password">Password</label>
            <input type="password" id="password" name="password">
          </div>
          <button type="submit" class="btn btn-primary">Login</button>
        </form>
      </div>
    </section>
    
    <!-- Quiz Selection View -->
    <section id="quiz-selection-view" class="app-view" style="display:none;">
      <h2>Available Quizzes</h2>
      <div id="quiz-list" class="quiz-list">
        <!-- Quizzes will be loaded here -->
      </div>
    </section>
    
    <!-- Active Quiz View -->
    <section id="active-quiz-view" class="app-view" style="display:none;">
      <div class="quiz-header">
        <h2 id="quiz-title">Quiz Title</h2>
        <div class="quiz-stats">
          <span id="question-counter">Question 1/10</span>
          <span id="score-display">Score: 0</span>
        </div>
      </div>
      
      <div id="question-container" class="question-container">
        <!-- Current question will be loaded here -->
      </div>
    </section>
    
    <!-- Results View -->
    <section id="results-view" class="app-view" style="display:none;">
      <h2>Quiz Results</h2>
      <div id="results-container" class="results-container">
        <!-- Results will be loaded here -->
      </div>
      <button id="back-to-quizzes" class="btn btn-primary">Back to Quizzes</button>
    </section>
  </div>
  
  <script src="/socket.io/socket.io.js"></script>
  <script type="module" src="client-main.js"></script>
</body>
</html>`
};

// Function to create directories and files
function createDirectoryStructure() {
  const rootDir = process.cwd();
  
  // Process each file path
  Object.entries(structure).forEach(([filePath, content]) => {
    const fullPath = path.join(rootDir, filePath);
    const dirName = path.dirname(fullPath);
    
    try {
      // Create directory if it doesn't exist
      if (!fs.existsSync(dirName)) {
        fs.mkdirSync(dirName, { recursive: true });
        console.log(`Created directory: ${dirName}`);
      }
      
      // Write file content
      fs.writeFileSync(fullPath, content);
      console.log(`Created file: ${filePath}`);
    } catch (error) {
      console.error(`Error creating ${filePath}:`, error);
    }
  });
}

// Main function
function main() {
  console.log('Creating AI-friendly directory structure for Interactive Quiz Application...');
  createDirectoryStructure(); // Call the function to create the structure
  console.log('Directory structure created successfully.');
}

// Run the script
main();

// client-side/client-modules/quiz-module.js
import { getAuthToken } from './auth-module.js';
import { showToast } from '../client-utils/ui-utils.js';

// Quiz state
let currentQuiz = null;
let currentQuestionIndex = 0;
let userAnswers = [];
let quizStartTime = null;
let timePerQuestion = 30; // Default time in seconds
let timerInterval = null;
let activeView = 'quiz-selection';

/**
 * Initialize the quiz module
 */
export function initQuizModule() {
  console.log('Initializing quiz module...');
  
  // Set up event listeners
  setupEventListeners();
  
  // Initialize UI
  setupQuizUI();
  
  // Make global functions available
  window.loadQuizzes = loadQuizzes;
  window.startQuiz = startQuiz;
  window.changeView = changeView;
  
  // Return API
  return {
    loadQuizzes,
    startQuiz,
    displayQuestion,
    selectAnswer,
    finishQuiz,
    showResults,
    changeView
  };
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
  // Quiz buttons
  const nextQuestionBtn = document.getElementById('next-question');
  if (nextQuestionBtn) {
    nextQuestionBtn.addEventListener('click', moveToNextQuestion);
  }
  
  const submitQuizBtn = document.getElementById('submit-quiz');
  if (submitQuizBtn) {
    submitQuizBtn.addEventListener('click', finishQuiz);
  }
  
  // Results view buttons
  const backToQuizzesBtn = document.getElementById('back-to-quizzes');
  if (backToQuizzesBtn) {
    backToQuizzesBtn.addEventListener('click', () => {
      changeView('quiz-selection');
      loadQuizzes();
    });
  }
  
  const reviewAnswersBtn = document.getElementById('review-answers');
  if (reviewAnswersBtn) {
    reviewAnswersBtn.addEventListener('click', reviewAnswers);
  }
  
  // Waiting room buttons
  const leaveRoomBtn = document.getElementById('leave-room-btn');
  if (leaveRoomBtn) {
    leaveRoomBtn.addEventListener('click', () => {
      // Leave room if in one
      if (currentQuiz) {
        leaveQuizRoom(currentQuiz.id);
      }
      
      changeView('quiz-selection');
    });
  }
  
  // Quiz refresh button
  const refreshQuizzesBtn = document.getElementById('refresh-quizzes-btn');
  if (refreshQuizzesBtn) {
    refreshQuizzesBtn.addEventListener('click', loadQuizzes);
  }
  
  // Quiz search
  const quizSearch = document.getElementById('quiz-search');
  if (quizSearch) {
    quizSearch.addEventListener('input', debounce(() => {
      filterQuizzes(quizSearch.value);
    }, 300));
  }
}

/**
 * Set up quiz UI
 */
function setupQuizUI() {
  // Make sure all views except the initial one are hidden
  const views = document.querySelectorAll('.view-section');
  views.forEach(view => {
    if (view.id === 'quiz-selection-view') {
      view.classList.add('active');
    } else {
      view.classList.remove('active');
    }
  });
}

/**
 * Change the current view
 * @param {string} viewName - The name of the view to show
 */
function changeView(viewName) {
  const views = document.querySelectorAll('.view-section');
  
  views.forEach(view => {
    if (view.id === `${viewName}-view`) {
      view.classList.add('active');
    } else {
      view.classList.remove('active');
    }
  });
  
  activeView = viewName;
  
  // Scroll to top when changing views
  window.scrollTo(0, 0);
}

/**
 * Load available quizzes
 */
async function loadQuizzes() {
  try {
    // Show loading state
    const quizGrid = document.getElementById('quiz-grid');
    if (quizGrid) {
      quizGrid.innerHTML = `
        <div class="quiz-loading">
          <div class="spinner"></div>
          <p>Loading quizzes...</p>
        </div>
      `;
    }
    // Get the token if available
    const token = getAuthToken();
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
    // Debugging output
    console.log('[DEBUG] loadQuizzes: token', token);
    console.log('[DEBUG] loadQuizzes: headers', headers);
    if (!token) {
      showToast('You must be logged in with a password to view quizzes. Please log out and log in again with your credentials.', 'warning');
      // Optionally, show login UI or redirect
      return;
    }
    // Fetch quizzes from server
    const response = await fetch('/interac/api/quiz/quizzes', {
      headers
    });
    if (!response.ok) {
      console.error('[DEBUG] loadQuizzes: response not ok', response.status, response.statusText);
      throw new Error('Failed to load quizzes');
    }
    const quizzes = await response.json();
    renderQuizList(quizzes);
  } catch (error) {
    console.error('Error loading quizzes:', error);
    showToast('Failed to load quizzes', 'error');
    // Show empty state
    const quizGrid = document.getElementById('quiz-grid');
    const noQuizzesElement = document.getElementById('no-quizzes');
    if (quizGrid) {
      quizGrid.innerHTML = '';
    }
    if (noQuizzesElement) {
      noQuizzesElement.style.display = 'flex';
    }
  }
}

/**
 * Render the quiz list
 * @param {Array} quizzes - Array of quiz objects
 */
function renderQuizList(quizzes) {
  const quizGrid = document.getElementById('quiz-grid');
  const noQuizzesElement = document.getElementById('no-quizzes');
  
  if (!quizGrid) return;
  
  if (!quizzes || !quizzes.length) {
    quizGrid.innerHTML = '';
    
    if (noQuizzesElement) {
      noQuizzesElement.style.display = 'flex';
    }
    
    return;
  }
  
  // Hide empty state
  if (noQuizzesElement) {
    noQuizzesElement.style.display = 'none';
  }
  
  // Clear the grid
  quizGrid.innerHTML = '';
  
  // Add quiz cards
  quizzes.forEach(quiz => {
    const difficultyClass = quiz.difficulty ? `quiz-difficulty-${quiz.difficulty.toLowerCase()}` : '';
    
    const quizCard = document.createElement('div');
    quizCard.className = `quiz-card ${difficultyClass}`;
    quizCard.dataset.quizId = quiz.id;
    
    quizCard.innerHTML = `
      <div class="quiz-card-header">
        <h3 class="quiz-card-title">${quiz.title || 'Untitled Quiz'}</h3>
        ${quiz.category ? `<span class="quiz-category">${quiz.category}</span>` : ''}
      </div>
      <div class="quiz-card-body">
        <p class="quiz-card-description">${quiz.description || 'No description available'}</p>
        <div class="quiz-card-meta">
          <div class="meta-item">
            <i class="fas fa-question-circle"></i>
            <span>${quiz.questions?.length || 0} questions</span>
          </div>
          <div class="meta-item">
            <i class="fas fa-clock"></i>
            <span>${quiz.timePerQuestion || 30}s per question</span>
          </div>
          ${quiz.difficulty ? `
          <div class="meta-item">
            <i class="fas fa-signal"></i>
            <span>${quiz.difficulty}</span>
          </div>
          ` : ''}
        </div>
      </div>
      <div class="quiz-card-footer">
        <button class="btn btn-primary start-quiz-btn">
          <i class="fas fa-play"></i> Start Quiz
        </button>
      </div>
    `;
    
    // Add quiz card click handler
    quizCard.querySelector('.start-quiz-btn').addEventListener('click', () => {
      startQuiz(quiz.id);
    });
    
    quizGrid.appendChild(quizCard);
  });
}

/**
 * Filter quizzes based on search term
 * @param {string} searchTerm - Search term
 */
function filterQuizzes(searchTerm = '') {
  const quizCards = document.querySelectorAll('.quiz-card');
  const noQuizzesElement = document.getElementById('no-quizzes');
  let visibleCount = 0;
  
  searchTerm = searchTerm.toLowerCase();
  
  quizCards.forEach(card => {
    const title = card.querySelector('.quiz-card-title')?.textContent?.toLowerCase() || '';
    const description = card.querySelector('.quiz-card-description')?.textContent?.toLowerCase() || '';
    
    if (title.includes(searchTerm) || description.includes(searchTerm)) {
      card.style.display = 'block';
      visibleCount++;
    } else {
      card.style.display = 'none';
    }
  });
  
  // Show empty state if no matches
  if (noQuizzesElement) {
    noQuizzesElement.style.display = visibleCount ? 'none' : 'flex';
  }
}

/**
 * Start a quiz
 * @param {number|string} quizId - Quiz ID
 */
async function startQuiz(quizId) {
  try {
    // Show loading toast
    showToast('Loading quiz...', 'info');
    
    // Get the token if available
    const token = getAuthToken();
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
    
    // Fetch quiz from server
    const response = await fetch(`/interac/api/quiz/quizzes/${quizId}`, {
      headers
    });
    
    if (!response.ok) {
      throw new Error('Failed to load quiz');
    }
    
    const quiz = await response.json();
    
    // Reset quiz state
    currentQuiz = quiz;
    currentQuestionIndex = 0;
    userAnswers = [];
    quizStartTime = new Date();
    timePerQuestion = quiz.timePerQuestion || 30;
    
    // Check if quiz has a waiting room
    if (quiz.hasWaitingRoom) {
      // Join waiting room
      if (window.socketClient) {
        window.socketClient.emit('join_room', `quiz_${quizId}`);
      }
      
      setupWaitingRoom(quiz);
      changeView('waiting-room');
    } else {
      // Start quiz immediately
      setupActiveQuiz(quiz);
      changeView('quiz-active');
    }
    
  } catch (error) {
    console.error('Error starting quiz:', error);
    showToast('Failed to start quiz', 'error');
  }
}

/**
 * Set up the waiting room
 * @param {Object} quiz - Quiz object
 */
function setupWaitingRoom(quiz) {
  // Set quiz name
  const quizNameElement = document.getElementById('waiting-quiz-name');
  if (quizNameElement) {
    quizNameElement.textContent = quiz.title || 'Quiz';
  }
  
  // If socket available, join quiz room
  if (window.socketClient) {
    window.socketClient.emit('join_room', `quiz_${quiz.id}`);
    
    // Listen for quiz start event
    window.socketClient.on('quiz:start', (data) => {
      if (data.quizId === quiz.id) {
        setupActiveQuiz(quiz);
        changeView('quiz-active');
      }
    });
  }
}

/**
 * Leave a quiz room
 * @param {number|string} quizId - Quiz ID
 */
function leaveQuizRoom(quizId) {
  if (window.socketClient) {
    window.socketClient.emit('leave_room', `quiz_${quizId}`);
  }
}

/**
 * Set up the active quiz
 * @param {Object} quiz - Quiz object
 */
function setupActiveQuiz(quiz) {
  // Set quiz title
  const quizTitleElement = document.getElementById('quiz-title');
  if (quizTitleElement) {
    quizTitleElement.textContent = quiz.title || 'Quiz';
  }
  
  // Set total questions
  const totalQuestionsElement = document.getElementById('total-questions');
  if (totalQuestionsElement) {
    totalQuestionsElement.textContent = quiz.questions?.length || 0;
  }
  
  // Display first question
  displayQuestion(0);
}

/**
 * Display a question
 * @param {number} index - Question index
 */
function displayQuestion(index) {
  if (!currentQuiz || !currentQuiz.questions) return;
  
  // Clear any existing timer
  if (timerInterval) {
    clearInterval(timerInterval);
  }
  
  // Set current question index
  currentQuestionIndex = index;
  
  // Get the question
  const question = currentQuiz.questions[index];
  if (!question) return;
  
  // Update question number
  const currentQuestionElement = document.getElementById('current-question');
  if (currentQuestionElement) {
    currentQuestionElement.textContent = index + 1;
  }
  
  // Update progress bar
  const progressBar = document.getElementById('progress-fill');
  if (progressBar) {
    const percent = ((index + 1) / currentQuiz.questions.length) * 100;
    progressBar.style.width = `${percent}%`;
  }
  
  // Set question text
  const questionTextElement = document.getElementById('question-text');
  if (questionTextElement) {
    questionTextElement.textContent = question.text;
  }
  
  // Clear previous options
  const optionsContainer = document.getElementById('answer-options');
  if (optionsContainer) {
    optionsContainer.innerHTML = '';
    
    // Add options
    if (Array.isArray(question.options)) {
      question.options.forEach((option, optionIndex) => {
        const optionText = typeof option === 'string' ? option : option.text;
        
        const optionElement = document.createElement('div');
        optionElement.className = 'answer-option';
        
        // If this option was previously selected, mark it
        if (userAnswers[currentQuestionIndex] === optionIndex) {
          optionElement.classList.add('selected');
        }
        
        optionElement.innerHTML = `
          <div class="option-letter">${String.fromCharCode(65 + optionIndex)}</div>
          <div class="option-text">${optionText}</div>
        `;
        
        // Add click event
        optionElement.addEventListener('click', () => {
          selectAnswer(optionIndex);
        });
        
        optionsContainer.appendChild(optionElement);
      });
    }
  }
  
  // Hide any explanation
  const explanationContainer = document.getElementById('explanation-container');
  if (explanationContainer) {
    explanationContainer.style.display = 'none';
  }
  
  // Update navigation buttons
  const nextQuestionBtn = document.getElementById('next-question');
  const submitQuizBtn = document.getElementById('submit-quiz');
  
  if (nextQuestionBtn && submitQuizBtn) {
    if (index === currentQuiz.questions.length - 1) {
      // Last question - show submit button
      nextQuestionBtn.style.display = 'none';
      submitQuizBtn.style.display = 'flex';
    } else {
      // Not last question - show next button
      nextQuestionBtn.style.display = 'flex';
      submitQuizBtn.style.display = 'none';
    }
  }
  
  // Start the timer
  const timerValueElement = document.getElementById('timer-value');
  if (timerValueElement) {
    // Reset timer
    questionTimer = timePerQuestion;
    timerValueElement.textContent = questionTimer;
    
    // Remove warning class if present
    const timerElement = document.querySelector('.quiz-timer');
    if (timerElement) {
      timerElement.classList.remove('timer-warning');
    }
    
    // Start countdown
    timerInterval = setInterval(() => {
      questionTimer--;
      
      if (timerValueElement) {
        timerValueElement.textContent = questionTimer;
      }
      
      // Add warning class when time is running low
      if (questionTimer <= 10 && timerElement) {
        timerElement.classList.add('timer-warning');
      }
      
      // Time's up
      if (questionTimer <= 0) {
        clearInterval(timerInterval);
        
        // Auto-move to next question or finish quiz
        if (currentQuestionIndex === currentQuiz.questions.length - 1) {
          finishQuiz();
        } else {
          moveToNextQuestion();
        }
      }
    }, 1000);
  }
}

/**
 * Select an answer
 * @param {number} optionIndex - Index of selected option
 */
function selectAnswer(optionIndex) {
  // Store user's answer
  userAnswers[currentQuestionIndex] = optionIndex;
  
  // Update UI
  const options = document.querySelectorAll('.answer-option');
  options.forEach(option => option.classList.remove('selected'));
  
  const selectedOption = document.querySelectorAll('.answer-option')[optionIndex];
  if (selectedOption) {
    selectedOption.classList.add('selected');
  }
  
  // Show explanation if available
  if (currentQuiz && currentQuiz.questions) {
    const question = currentQuiz.questions[currentQuestionIndex];
    if (question && question.options) {
      const option = question.options[optionIndex];
      
      // Handle different option formats
      const rationale = typeof option === 'object' ? option.rationale : null;
      
      if (rationale) {
        const explanationContainer = document.getElementById('explanation-container');
        const explanationText = document.getElementById('explanation-text');
        
        if (explanationContainer && explanationText) {
          explanationText.textContent = rationale;
          explanationContainer.style.display = 'block';
        }
      }
    }
  }
}

/**
 * Move to next question
 */
function moveToNextQuestion() {
  if (!currentQuiz || !currentQuiz.questions) return;
  
  if (currentQuestionIndex < currentQuiz.questions.length - 1) {
    displayQuestion(currentQuestionIndex + 1);
  }
}

/**
 * Finish the quiz
 */
function finishQuiz() {
  // Clear timer
  if (timerInterval) {
    clearInterval(timerInterval);
  }
  
  // Calculate results
  const results = calculateResults();
  
  // Save results
  saveQuizResults(results)
    .then(() => {
      console.log('Quiz results saved');
    })
    .catch(error => {
      console.error('Error saving quiz results:', error);
    });
  
  // Show results
  showResults(results);
}

/**
 * Calculate quiz results
 * @returns {Object} Results object
 */
function calculateResults() {
  if (!currentQuiz || !currentQuiz.questions) {
    return {
      score: 0,
      correctAnswers: 0,
      totalQuestions: 0,
      timeTaken: 0,
      quizId: null,
      quizTitle: null
    };
  }
  
  const totalQuestions = currentQuiz.questions.length;
  let correctAnswers = 0;
  
  // Count correct answers
  currentQuiz.questions.forEach((question, index) => {
    const userAnswer = userAnswers[index];
    
    // Skip if question not answered
    if (userAnswer === undefined) return;
    
    // Check if answer is correct
    const correctOption = question.options.findIndex(opt => {
      return typeof opt === 'object' ? opt.isCorrect : false;
    });
    
    if (userAnswer === correctOption) {
      correctAnswers++;
    }
  });
  
  // Calculate score as percentage
  const score = Math.round((correctAnswers / totalQuestions) * 100);
  
  // Calculate time taken
  const timeTaken = Math.round((new Date() - quizStartTime) / 1000);
  
  return {
    quizId: currentQuiz.id,
    quizTitle: currentQuiz.title,
    score,
    correctAnswers,
    totalQuestions,
    timeTaken,
    userAnswers
  };
}

/**
 * Save quiz results to server
 * @param {Object} results - Quiz results
 */
async function saveQuizResults(results) {
  try {
    // Get the token if available
    const token = getAuthToken();
    const headers = {
      'Content-Type': 'application/json'
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    // Send results to server
    const response = await fetch('/interac/api/quiz/results', {
      method: 'POST',
      headers,
      body: JSON.stringify(results)
    });
    
    if (!response.ok) {
      throw new Error('Failed to save quiz results');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error saving quiz results:', error);
    throw error;
  }
}

/**
 * Show quiz results
 * @param {Object} results - Quiz results
 */
function showResults(results) {
  // Change to results view
  changeView('results-view');
  
  // Update UI elements
  const finalScoreElement = document.getElementById('final-score');
  if (finalScoreElement) {
    finalScoreElement.textContent = `${results.score}%`;
  }
  
  const correctAnswersElement = document.getElementById('correct-answers');
  if (correctAnswersElement) {
    correctAnswersElement.textContent = `${results.correctAnswers}/${results.totalQuestions}`;
  }
  
  // Format and display time taken
  const minutes = Math.floor(results.timeTaken / 60);
  const seconds = results.timeTaken % 60;
  const formattedTime = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  
  const timeTakenElement = document.getElementById('time-taken');
  if (timeTakenElement) {
    timeTakenElement.textContent = formattedTime;
  }
  
  // Set feedback message based on score
  let feedbackMessage = '';
  
  if (results.score >= 90) {
    feedbackMessage = 'Outstanding! You\'ve mastered this topic!';
  } else if (results.score >= 75) {
    feedbackMessage = 'Great job! You have a solid understanding of this material.';
  } else if (results.score >= 60) {
    feedbackMessage = 'Good effort! Review the topics you missed to improve your score.';
  } else if (results.score >= 40) {
    feedbackMessage = 'Keep practicing! You\'re making progress but need more review.';
  } else {
    feedbackMessage = 'Don\'t worry! Everyone starts somewhere. Try reviewing the material again.';
  }
  
  const feedbackElement = document.getElementById('results-feedback');
  if (feedbackElement) {
    feedbackElement.textContent = feedbackMessage;
  }
  
  // Add confetti animation for high scores
  if (results.score >= 70) {
    addConfettiAnimation();
  }
  
  // Update user profile stats
  updateUserStats(results);
}

/**
 * Update user stats
 * @param {Object} results - Quiz results
 */
function updateUserStats(results) {
  // Get stats elements
  const quizzesCompletedElement = document.getElementById('quizzes-completed');
  const avgScoreElement = document.getElementById('avg-score');
  
  if (quizzesCompletedElement && avgScoreElement) {
    // Get current values
    const quizzesCompleted = parseInt(quizzesCompletedElement.textContent) || 0;
    const avgScore = parseInt(avgScoreElement.textContent) || 0;
    
    // Calculate new values
    const newQuizzesCompleted = quizzesCompleted + 1;
    const newAvgScore = Math.round((avgScore * quizzesCompleted + results.score) / newQuizzesCompleted);
    
    // Update UI
    quizzesCompletedElement.textContent = newQuizzesCompleted;
    avgScoreElement.textContent = newAvgScore;
  }
  
  // Add to activity list
  addActivityItem(results);
}

/**
 * Add activity item to recent activity
 * @param {Object} results - Quiz results
 */
function addActivityItem(results) {
  const activityList = document.getElementById('activity-list');
  if (!activityList) return;
  
  // Remove empty state if present
  const emptyState = activityList.querySelector('.empty-state');
  if (emptyState) {
    emptyState.remove();
  }
  
  // Create activity item
  const activityItem = document.createElement('div');
  activityItem.className = 'activity-item';
  
  // Format date
  const now = new Date();
  const formattedDate = now.toLocaleString();
  
  // Add content
  activityItem.innerHTML = `
    <div class="activity-content">
      <p>Completed: <strong>${results.quizTitle}</strong></p>
      <p>Score: <strong>${results.score}%</strong> (${results.correctAnswers}/${results.totalQuestions})</p>
    </div>
    <div class="activity-time">${formattedDate}</div>
  `;
  
  // Add to top of list
  activityList.insertBefore(activityItem, activityList.firstChild);
}

/**
 * Add confetti animation
 */
function addConfettiAnimation() {
  const confettiContainer = document.querySelector('.confetti-animation');
  if (!confettiContainer) return;
  
  // Clear existing confetti
  confettiContainer.innerHTML = '';
  
  // Create confetti pieces
  for (let i = 0; i < 50; i++) {
    const confetti = document.createElement('div');
    confetti.className = 'confetti-piece';
    
    // Randomize confetti properties
    confetti.style.left = `${Math.random() * 100}%`;
    confetti.style.width = `${Math.random() * 10 + 5}px`;
    confetti.style.height = `${Math.random() * 10 + 5}px`;
    confetti.style.background = `hsl(${Math.random() * 360}, 80%, 60%)`;
    confetti.style.animationDelay = `${Math.random() * 2}s`;
    
    confettiContainer.appendChild(confetti);
  }
}

/**
 * Review answers
 */
function reviewAnswers() {
  if (!currentQuiz || !currentQuiz.questions) {
    showToast('No quiz data available for review', 'error');
    return;
  }
  
  // Implementation would typically show a review UI
  // For now, just show a toast message
  showToast('Review functionality coming soon!', 'info');
}

/**
 * Debounce function for search input
 * @param {Function} func - Function to debounce
 * @param {number} wait - Delay in ms
 * @returns {Function} Debounced function
 */
function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

// Export functions for use in other modules
export {
  loadQuizzes,
  startQuiz,
  displayQuestion,
  selectAnswer,
  moveToNextQuestion,
  finishQuiz,
  showResults,
  changeView
};
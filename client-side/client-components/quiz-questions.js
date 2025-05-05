// client-side/client-components/quiz-question.js
import { getTokenFromStorage } from '../client-utils/client-helpers.js';

// State for the current quiz
let currentQuiz = null;
let currentQuestionIndex = 0;
let userAnswers = [];
let quizStartTime = null;
let questionTimer = null;
let timePerQuestion = 30; // Default time per question in seconds
let timerInterval = null;

// Elements
const quizModal = document.getElementById('quiz-modal');
const quizTitle = document.getElementById('quiz-title');
const currentQuestionEl = document.getElementById('current-question');
const totalQuestionsEl = document.getElementById('total-questions');
const progressFill = document.getElementById('progress-fill');
const timerValue = document.getElementById('timer-value');
const questionText = document.getElementById('question-text');
const answerOptions = document.getElementById('answer-options');
const explanationContainer = document.getElementById('explanation-container');
const explanationText = document.getElementById('explanation-text');
const nextQuestionBtn = document.getElementById('next-question');
const submitQuizBtn = document.getElementById('submit-quiz');

// Initialize quiz components when DOM is loaded
export function initQuizComponents() {
  // Setup event listeners
  document.addEventListener('click', event => {
    // Detect clicks on quiz cards
    if (event.target.closest('.quiz-card')) {
      const quizCard = event.target.closest('.quiz-card');
      const quizId = quizCard.dataset.quizId;
      startQuiz(quizId);
    }
  });
  
  // Close modal when clicking the X
  document.querySelector('.close-modal').addEventListener('click', () => {
    closeQuizModal();
  });
  
  // Next question button
  nextQuestionBtn.addEventListener('click', () => {
    moveToNextQuestion();
  });
  
  // Submit quiz button
  submitQuizBtn.addEventListener('click', () => {
    finishQuiz();
  });
  
  // Initialize quiz list
  loadQuizzes();
}

// Fetch available quizzes
async function loadQuizzes() {
  try {
    const token = getTokenFromStorage();
    if (!token) return;
    
    const response = await fetch('/interac/api/quizzes', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to load quizzes');
    }
    
    const quizzes = await response.json();
    
    renderQuizList(quizzes);
  } catch (error) {
    console.error('Error loading quizzes:', error);
    showEmptyState();
  }
}

// Render the quiz list
function renderQuizList(quizzes) {
  const quizList = document.getElementById('quiz-list');
  
  if (!quizzes || quizzes.length === 0) {
    showEmptyState();
    return;
  }
  
  quizList.innerHTML = '';
  
  quizzes.forEach(quiz => {
    const quizCard = document.createElement('div');
    quizCard.className = 'quiz-card';
    quizCard.dataset.quizId = quiz.id;
    
    quizCard.innerHTML = `
      <div class="quiz-card-header">
        <h3 class="quiz-card-title">${quiz.title}</h3>
      </div>
      <div class="quiz-card-body">
        <p class="quiz-card-description">${quiz.description || 'No description available'}</p>
        <div class="quiz-card-meta">
          <div class="meta-item">
            <i class="fas fa-question-circle"></i>
            <span>${quiz.questions.length} questions</span>
          </div>
          <div class="meta-item">
            <i class="fas fa-clock"></i>
            <span>${quiz.timePerQuestion || 30}s per question</span>
          </div>
        </div>
      </div>
      <div class="quiz-card-footer">
        <button class="btn">Start Quiz</button>
      </div>
    `;
    
    quizList.appendChild(quizCard);
  });
  
  document.getElementById('no-quizzes').classList.add('hidden');
}

// Show empty state when no quizzes available
function showEmptyState() {
  document.getElementById('quiz-list').innerHTML = '';
  document.getElementById('no-quizzes').classList.remove('hidden');
}

// Start a quiz
async function startQuiz(quizId) {
  try {
    const token = getTokenFromStorage();
    if (!token) return;
    
    const response = await fetch(`/interac/api/quizzes/${quizId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to load quiz');
    }
    
    currentQuiz = await response.json();
    currentQuestionIndex = 0;
    userAnswers = [];
    quizStartTime = new Date();
    timePerQuestion = currentQuiz.timePerQuestion || 30;
    
    // Show the quiz modal
    quizTitle.textContent = currentQuiz.title;
    totalQuestionsEl.textContent = currentQuiz.questions.length;
    
    // Display first question
    displayQuestion(currentQuestionIndex);
    
    // Show the modal
    quizModal.classList.remove('hidden');
    quizModal.classList.add('active');
    
  } catch (error) {
    console.error('Error starting quiz:', error);
    alert('Failed to start quiz. Please try again.');
  }
}

// Display a question
function displayQuestion(index) {
  // Clear any previous timer
  if (timerInterval) {
    clearInterval(timerInterval);
  }
  
  const question = currentQuiz.questions[index];
  
  // Update UI elements
  currentQuestionEl.textContent = index + 1;
  progressFill.style.width = `${((index + 1) / currentQuiz.questions.length) * 100}%`;
  questionText.textContent = question.text;
  
  // Clear previous answers
  answerOptions.innerHTML = '';
  
  // Add answer options
  question.options.forEach((option, optionIndex) => {
    const optionEl = document.createElement('div');
    optionEl.className = 'answer-option';
    optionEl.dataset.index = optionIndex;
    optionEl.textContent = option.text;
    
    // Check if already answered
    if (userAnswers[index] !== undefined && userAnswers[index] === optionIndex) {
      optionEl.classList.add('selected');
    }
    
    optionEl.addEventListener('click', () => selectAnswer(optionIndex));
    
    answerOptions.appendChild(optionEl);
  });
  
  // Hide explanation
  explanationContainer.classList.add('hidden');
  
  // Update buttons
  if (index === currentQuiz.questions.length - 1) {
    nextQuestionBtn.classList.add('hidden');
    submitQuizBtn.classList.remove('hidden');
  } else {
    nextQuestionBtn.classList.remove('hidden');
    submitQuizBtn.classList.add('hidden');
  }
  
  // Start timer
  questionTimer = timePerQuestion;
  timerValue.textContent = questionTimer;
  
  timerInterval = setInterval(() => {
    questionTimer--;
    timerValue.textContent = questionTimer;
    
    if (questionTimer <= 10) {
      timerValue.parentElement.style.color = 'var(--error-color)';
    } else {
      timerValue.parentElement.style.color = 'var(--text-color)';
    }
    
    if (questionTimer <= 0) {
      clearInterval(timerInterval);
      
      // Auto-move to next question or submit if last question
      if (index === currentQuiz.questions.length - 1) {
        finishQuiz();
      } else {
        moveToNextQuestion();
      }
    }
  }, 1000);
}

// Select an answer
function selectAnswer(optionIndex) {
  // Store the answer
  userAnswers[currentQuestionIndex] = optionIndex;
  
  // Update UI
  const options = document.querySelectorAll('.answer-option');
  options.forEach(option => option.classList.remove('selected'));
  
  const selectedOption = document.querySelector(`.answer-option[data-index="${optionIndex}"]`);
  if (selectedOption) {
    selectedOption.classList.add('selected');
  }
}

// Move to the next question
function moveToNextQuestion() {
  if (currentQuestionIndex < currentQuiz.questions.length - 1) {
    currentQuestionIndex++;
    displayQuestion(currentQuestionIndex);
  }
}

// Finish the quiz
function finishQuiz() {
  // Clear timer
  if (timerInterval) {
    clearInterval(timerInterval);
  }
  
  // Calculate results
  const results = calculateResults();
  
  // Close quiz modal
  closeQuizModal();
  
  // Show results modal
  showResults(results);
  
  // Save results to server
  saveQuizResults(results);
}

// Calculate quiz results
function calculateResults() {
  const totalQuestions = currentQuiz.questions.length;
  let correctAnswers = 0;
  
  currentQuiz.questions.forEach((question, index) => {
    const userAnswer = userAnswers[index];
    
    // If user answered and it's correct
    if (userAnswer !== undefined && question.options[userAnswer].isCorrect) {
      correctAnswers++;
    }
  });
  
  const score = Math.round((correctAnswers / totalQuestions) * 100);
  const timeTaken = Math.round((new Date() - quizStartTime) / 1000); // in seconds
  
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

// Close the quiz modal
function closeQuizModal() {
  quizModal.classList.remove('active');
  setTimeout(() => {
    quizModal.classList.add('hidden');
  }, 300);
}

// Save quiz results to server
async function saveQuizResults(results) {
  try {
    const token = getTokenFromStorage();
    if (!token) return;
    
    await fetch('/interac/api/quiz-results', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(results)
    });
  } catch (error) {
    console.error('Error saving quiz results:', error);
  }
}

// Export functions for use in other modules
export { startQuiz, closeQuizModal };
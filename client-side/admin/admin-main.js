// client-side/admin/admin-main.js
import { getTokenFromStorage } from '../client-utils/client-helpers.js';
import { aiService } from './service/ai-service.js';
import { similarityService } from './service/ai-similarity-service.js';

// --- Admin Auth Logic ---
function showAdminLogin() {
  document.getElementById('admin-login-container').style.display = 'block';
  document.querySelector('.admin-container').style.display = 'none';
}
function showAdminDashboard() {
  document.getElementById('admin-login-container').style.display = 'none';
  document.querySelector('.admin-container').style.display = 'block';
}

// On page load, check for token
const token = localStorage.getItem('auth_token');
if (!token) {
  showAdminLogin();
} else {
  showAdminDashboard();
}

// Handle admin login
const loginBtn = document.getElementById('admin-login-btn');
if (loginBtn) {
  loginBtn.addEventListener('click', async () => {
    const username = document.getElementById('admin-username').value.trim();
    const password = document.getElementById('admin-password').value;
    const errorDiv = document.getElementById('admin-login-error');
    errorDiv.textContent = '';
    if (!username || !password) {
      errorDiv.textContent = 'Please enter both username and password.';
      return;
    }
    try {
      const res = await fetch('/interac/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (res.ok && data.token) {
        localStorage.setItem('auth_token', data.token);
        showAdminDashboard();
        window.location.reload();
      } else {
        errorDiv.textContent = data.error || 'Login failed';
      }
    } catch (err) {
      errorDiv.textContent = 'Server error. Please try again.';
    }
  });
}

// State
let quizzes = [];
let currentPage = 1;
let totalPages = 1;
let generationCancelled = false;
let currentEditingQuestion = null;

// DOM Elements
document.addEventListener('DOMContentLoaded', () => {
  // Initialize the admin interface
  initAdminUI();
  
  // Load quiz data
  loadQuizzes();
});

// Initialize admin UI
function initAdminUI() {
  // Setup navigation
  setupNavigation();
  
  // Setup modal handlers
  setupModalHandlers();
  
  // Setup quiz management
  setupQuizManagement();
}

// Setup navigation
function setupNavigation() {
  const menuItems = document.querySelectorAll('.menu-item');
  const views = document.querySelectorAll('.admin-view');
  
  // Handle menu item clicks
  menuItems.forEach(item => {
    item.addEventListener('click', () => {
      const viewName = item.dataset.view;
      
      // Update active menu item
      menuItems.forEach(mi => mi.classList.remove('active'));
      item.classList.add('active');
      
      // Show corresponding view
      views.forEach(view => {
        if (view.id === `${viewName}-view`) {
          view.classList.add('active');
        } else {
          view.classList.remove('active');
        }
      });
    });
  });
  
  // Logout button
  document.getElementById('logout-btn').addEventListener('click', () => {
    localStorage.removeItem('auth_token');
    showAdminLogin();
  });
}

// Setup modal handlers
function setupModalHandlers() {
  // Create Quiz Modal
  const createQuizBtn = document.getElementById('create-quiz-btn');
  const createQuizModal = document.getElementById('create-quiz-modal');
  const closeModalBtn = document.querySelector('.close-modal');
  const cancelCreateBtn = document.getElementById('cancel-create-btn');
  
  createQuizBtn.addEventListener('click', () => {
    showModal(createQuizModal);
  });
  
  closeModalBtn.addEventListener('click', () => {
    hideModal(createQuizModal);
  });
  
  cancelCreateBtn.addEventListener('click', () => {
    hideModal(createQuizModal);
  });
  
  // Tab switching
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabName = btn.dataset.tab;
      
      // Update active tab
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      // Show corresponding content
      tabContents.forEach(content => {
        if (content.id === `${tabName}-form`) {
          content.classList.add('active');
        } else {
          content.classList.remove('active');
        }
      });
    });
  });
  
  // Preview Modal
  const closePreviewBtn = document.querySelector('.close-preview-modal');
  const quizPreviewModal = document.getElementById('quiz-preview-modal');
  
  closePreviewBtn.addEventListener('click', () => {
    hideModal(quizPreviewModal);
  });
  
  // Edit Question Modal
  const closeEditBtn = document.querySelector('.close-edit-modal');
  const editQuestionModal = document.getElementById('edit-question-modal');
  
  closeEditBtn.addEventListener('click', () => {
    hideModal(editQuestionModal);
  });
  
  // Similarity Check Modal
  const closeSimilarityBtn = document.querySelector('.close-similarity-modal');
  const similarityCheckModal = document.getElementById('similarity-check-modal');
  
  closeSimilarityBtn.addEventListener('click', () => {
    hideModal(similarityCheckModal);
  });
  
  document.getElementById('close-similarity-btn').addEventListener('click', () => {
    hideModal(similarityCheckModal);
  });
}

// Setup quiz management
function setupQuizManagement() {
  // Create quiz form
  const createQuizSubmitBtn = document.getElementById('create-quiz-submit-btn');
  
  createQuizSubmitBtn.addEventListener('click', () => {
    const activeTab = document.querySelector('.tab-btn.active').dataset.tab;
    
    if (activeTab === 'ai-generate') {
      handleCreateQuizSubmit();
    } else {
      handleManualQuizSubmit();
    }
  });
  
  // Manual quiz form options
  const addQuestionBtn = document.getElementById('add-question-btn');
  
  addQuestionBtn.addEventListener('click', () => {
    addManualQuestion();
  });
  
  // Quiz preview interactions
  const editQuizBtn = document.getElementById('edit-quiz-btn');
  const publishQuizBtn = document.getElementById('publish-quiz-btn');
  
  editQuizBtn.addEventListener('click', () => {
    // Hide preview modal and show edit modal
    hideModal(document.getElementById('quiz-preview-modal'));
    showModal(document.getElementById('create-quiz-modal'));
  });
  
  publishQuizBtn.addEventListener('click', () => {
    publishQuiz();
  });
  
  // Generation progress interactions
  const cancelGenerationBtn = document.getElementById('cancel-generation-btn');
  
  cancelGenerationBtn.addEventListener('click', () => {
    generationCancelled = true;
    addGenerationLog('Generation cancelled by user.');
    
    // Enable the button to close the modal
    cancelGenerationBtn.textContent = 'Close';
    cancelGenerationBtn.addEventListener('click', () => {
      hideModal(document.getElementById('generation-progress-modal'));
    }, { once: true });
  });
  
  // Edit question interactions
  const addOptionBtn = document.getElementById('add-option-btn');
  const saveQuestionBtn = document.getElementById('save-question-btn');
  const regenerateQuestionBtn = document.getElementById('regenerate-question-btn');
  
  addOptionBtn.addEventListener('click', () => {
    addQuestionOption();
  });
  
  saveQuestionBtn.addEventListener('click', () => {
    saveQuestionChanges();
  });
  
  regenerateQuestionBtn.addEventListener('click', () => {
    regenerateQuestion();
  });
}

// Load quizzes
async function loadQuizzes() {
  try {
    const token = getTokenFromStorage();
    if (!token) {
      showAdminLogin();
      return;
    }
    
    const response = await fetch('/interac/api/quizzes?page=' + currentPage, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to load quizzes');
    }
    
    const data = await response.json();
    quizzes = data.quizzes;
    totalPages = data.totalPages || 1;
    
    renderQuizzes();
    updatePagination();
  } catch (error) {
    console.error('Error loading quizzes:', error);
    // Show error message
  }
}

// Render quizzes table
function renderQuizzes() {
  const tableBody = document.querySelector('#quizzes-table tbody');
  
  if (!quizzes || quizzes.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="5" class="text-center">No quizzes found</td>
      </tr>
    `;
    return;
  }
  
  tableBody.innerHTML = '';
  
  quizzes.forEach(quiz => {
    const row = document.createElement('tr');
    
    // Format date
    const createdDate = new Date(quiz.createdAt).toLocaleDateString();
    
    row.innerHTML = `
      <td>${quiz.title}</td>
      <td>${quiz.questions.length}</td>
      <td>${createdDate}</td>
      <td><span class="status-badge status-${quiz.status.toLowerCase()}">${quiz.status}</span></td>
      <td class="actions">
        <button class="action-btn view-btn" data-id="${quiz.id}" title="View Quiz">
          <i class="fas fa-eye"></i>
        </button>
        <button class="action-btn edit-btn" data-id="${quiz.id}" title="Edit Quiz">
          <i class="fas fa-edit"></i>
        </button>
        <button class="action-btn delete-btn" data-id="${quiz.id}" title="Delete Quiz">
          <i class="fas fa-trash"></i>
        </button>
      </td>
    `;
    
    // Add event listeners
    row.querySelector('.view-btn').addEventListener('click', () => {
      previewQuiz(quiz.id);
    });
    
    row.querySelector('.edit-btn').addEventListener('click', () => {
      editQuiz(quiz.id);
    });
    
    row.querySelector('.delete-btn').addEventListener('click', () => {
      deleteQuiz(quiz.id);
    });
    
    tableBody.appendChild(row);
  });
}

// Update pagination
function updatePagination() {
  document.getElementById('page-info').textContent = `Page ${currentPage} of ${totalPages}`;
  
  const prevBtn = document.getElementById('prev-page');
  const nextBtn = document.getElementById('next-page');
  
  prevBtn.disabled = currentPage <= 1;
  nextBtn.disabled = currentPage >= totalPages;
  
  prevBtn.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      loadQuizzes();
    }
  });
  
  nextBtn.addEventListener('click', () => {
    if (currentPage < totalPages) {
      currentPage++;
      loadQuizzes();
    }
  });
}

// Handle AI quiz creation
async function handleCreateQuizSubmit() {
  // Get form values
  const quizName = document.getElementById('quiz-name').value;
  const quizDescription = document.getElementById('quiz-description').value;
  const timePerQuestion = document.getElementById('time-per-question').value;
  const rationaleTone = document.getElementById('rationale-tone').value;
  const aiTopic = document.getElementById('ai-topic').value;
  const numQuestions = document.getElementById('num-questions').value;
  const difficulty = document.getElementById('difficulty').value;
  const optionsPerQuestion = document.getElementById('options-per-question').value;
  const batchSize = document.getElementById('batch-size').value;
  const specificFocuses = document.getElementById('specific-focuses').value;
  
  // Validate form
  if (!quizName || !aiTopic || !numQuestions) {
    alert('Quiz name, topic, and number of questions are required');
    return;
  }
  
  // Show generation progress modal
  const progressModal = document.getElementById('generation-progress-modal');
  showModal(progressModal);
  hideModal(document.getElementById('create-quiz-modal'));
  
  // Reset generation state
  generationCancelled = false;
  updateGenerationProgress(0, numQuestions);
  resetGenerationLog();
  
  try {
    // Start timer for elapsed time calculation
    const startTime = Date.now();
    const updateTimer = setInterval(() => {
      const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
      const minutes = Math.floor(elapsedSeconds / 60);
      const seconds = elapsedSeconds % 60;
      document.getElementById('elapsed-time').textContent = 
        `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }, 1000);
    
    // Create basic quiz structure
    addGenerationLog('Creating quiz structure...');
    
    const token = getTokenFromStorage();
    const response = await fetch('/interac/api/quizzes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        title: quizName,
        description: quizDescription,
        timePerQuestion: parseInt(timePerQuestion),
        status: 'DRAFT',
        questions: []
      })
    });
    
    if (!response.ok) {
      throw new Error('Failed to create quiz');
    }
    
    const quiz = await response.json();
    addGenerationLog('Quiz structure created successfully.');
    
    // Generate questions in batches
    const aiConfig = {
      topic: aiTopic,
      difficulty,
      rationaleTone,
      optionsPerQuestion: parseInt(optionsPerQuestion),
      specificFocuses: specificFocuses ? specificFocuses.split(',').map(f => f.trim()) : [],
      batchSize: parseInt(batchSize)
    };
    
    const generatedQuestions = await generateQuizQuestionsInBackground(
      quiz.id, 
      parseInt(numQuestions), 
      aiConfig, 
      updateGenerationProgress
    );
    
    // Stop the timer
    clearInterval(updateTimer);
    
    if (generationCancelled) {
      addGenerationLog('Generation process was cancelled. Partial questions may have been saved.');
      return;
    }
    
    // Success
    addGenerationLog(`Generation complete! ${generatedQuestions.length} questions were created.`);
    
    // Update the cancel button to become a "View Quiz" button
    const cancelBtn = document.getElementById('cancel-generation-btn');
    cancelBtn.textContent = 'View Quiz';
    cancelBtn.removeEventListener('click', null);
    cancelBtn.addEventListener('click', () => {
      hideModal(progressModal);
      previewQuiz(quiz.id);
    }, { once: true });
    
  } catch (error) {
    console.error('Error generating quiz:', error);
    addGenerationLog(`Error: ${error.message}`);
    
    // Update the cancel button text
    document.getElementById('cancel-generation-btn').textContent = 'Close';
  }
}

// Generate quiz questions in background
async function generateQuizQuestionsInBackground(quizId, numQuestions, aiConfig, progressCallback) {
  const generatedQuestions = [];
  const token = getTokenFromStorage();
  
  try {
    // Calculate batch size
    const batchSize = aiConfig.batchSize || 5;
    const batches = Math.ceil(numQuestions / batchSize);
    
    addGenerationLog(`Generating ${numQuestions} questions in ${batches} batches...`);
    
    // Track time for estimation
    const startTime = Date.now();
    let questionsGenerated = 0;
    
    // Process in batches
    for (let i = 0; i < batches; i++) {
      if (generationCancelled) {
        addGenerationLog('Generation cancelled. Stopping process...');
        break;
      }
      
      const batchQuestionsToGenerate = Math.min(batchSize, numQuestions - questionsGenerated);
      
      addGenerationLog(`Generating batch ${i + 1}/${batches} (${batchQuestionsToGenerate} questions)...`);
      
      // Generate batch of questions
      const batchQuestions = await aiService.generateQuestions(
        aiConfig.topic,
        batchQuestionsToGenerate,
        {
          difficulty: aiConfig.difficulty,
          rationaleTone: aiConfig.rationaleTone,
          optionsPerQuestion: aiConfig.optionsPerQuestion,
          specificFocuses: aiConfig.specificFocuses,
          existingQuestions: generatedQuestions // Pass existing questions to avoid duplicates
        }
      );
      
      // Add to generated questions array
      generatedQuestions.push(...batchQuestions);
      questionsGenerated += batchQuestions.length;
      
      // Update progress
      progressCallback(questionsGenerated, numQuestions);
      document.getElementById('questions-generated').textContent = `${questionsGenerated}/${numQuestions}`;
      
      // Calculate and update estimated time remaining
      if (i > 0) {
        const elapsedTime = Date.now() - startTime;
        const timePerQuestion = elapsedTime / questionsGenerated;
        const remainingQuestions = numQuestions - questionsGenerated;
        const estimatedTimeRemaining = Math.floor((timePerQuestion * remainingQuestions) / 1000);
        
        const minutes = Math.floor(estimatedTimeRemaining / 60);
        const seconds = estimatedTimeRemaining % 60;
        
        document.getElementById('estimated-time').textContent = 
          `${minutes}m ${seconds}s`;
      }
      
      // Save batch to the server
      addGenerationLog(`Saving batch ${i + 1} to the server...`);
      
      const response = await fetch(`/interac/api/quizzes/${quizId}/questions/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ questions: batchQuestions })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to save batch ${i + 1}`);
      }
      
      addGenerationLog(`Batch ${i + 1} saved successfully.`);
    }
    
    // Check for question similarity
    if (generatedQuestions.length >= 5 && !generationCancelled) {
      addGenerationLog('Checking for similar questions...');
      
      const similarityResults = await similarityService.checkSimilarity(generatedQuestions);
      
      if (similarityResults && similarityResults.length > 0) {
        addGenerationLog(`Found ${similarityResults.length} groups of similar questions.`);
      } else {
        addGenerationLog('No overly similar questions found.');
      }
    }
    
    return generatedQuestions;
    
  } catch (error) {
    console.error('Error generating questions:', error);
    addGenerationLog(`Error: ${error.message}`);
    throw error;
  }
}

// Update generation progress
function updateGenerationProgress(current, total) {
  const percentage = Math.round((current / total) * 100);
  document.getElementById('generation-progress-fill').style.width = `${percentage}%`;
  document.getElementById('generation-progress-text').textContent = `${percentage}%`;
}

// Add a log entry to the generation log
function addGenerationLog(message) {
  const logContainer = document.getElementById('generation-log-container');
  const logEntry = document.createElement('div');
  logEntry.className = 'log-entry';
  
  // Add timestamp
  const now = new Date();
  const time = now.toLocaleTimeString();
  
  logEntry.textContent = `[${time}] ${message}`;
  
  logContainer.appendChild(logEntry);
  logContainer.scrollTop = logContainer.scrollHeight;
}

// Reset the generation log
function resetGenerationLog() {
  const logContainer = document.getElementById('generation-log-container');
  logContainer.innerHTML = '';
  addGenerationLog('Initializing AI service...');
}

// Preview a quiz
async function previewQuiz(quizId) {
  try {
    const token = getTokenFromStorage();
    const response = await fetch(`/interac/api/quizzes/${quizId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to load quiz');
    }
    
    const quiz = await response.json();
    
    // Populate preview modal
    document.getElementById('preview-quiz-name').textContent = quiz.title;
    document.getElementById('preview-quiz-description').textContent = quiz.description || 'No description provided';
    document.getElementById('preview-quiz-questions').textContent = `${quiz.questions.length} Questions`;
    document.getElementById('preview-quiz-time').textContent = `${quiz.timePerQuestion || 30}s per question`;
    
    // Render questions
    renderPreviewQuestions(quiz.questions);
    
    // Show modal
    showModal(document.getElementById('quiz-preview-modal'));
  } catch (error) {
    console.error('Error loading quiz preview:', error);
    alert('Failed to load quiz preview');
  }
}

// Render preview questions
function renderPreviewQuestions(questions) {
  const container = document.getElementById('preview-questions-container');
  container.innerHTML = '';
  
  questions.forEach((question, index) => {
    const questionElement = document.createElement('div');
    questionElement.className = 'preview-question-item';
    
    // Find correct option
    const correctOption = question.options.find(opt => opt.isCorrect);
    
    questionElement.innerHTML = `
      <div class="preview-question-header">
        <h3>Question ${index + 1}</h3>
        <div class="question-actions">
          <button class="action-btn edit-question-btn" data-index="${index}">
            <i class="fas fa-edit"></i>
          </button>
          <button class="action-btn regenerate-btn" data-index="${index}">
            <i class="fas fa-sync-alt"></i>
          </button>
        </div>
      </div>
      <p class="preview-question-text">${question.text}</p>
      <div class="preview-options">
        ${question.options.map((option, optIndex) => `
          <div class="preview-option-item ${option.isCorrect ? 'correct' : ''}">
            <div class="preview-option-marker ${option.isCorrect ? 'correct' : ''}"></div>
            <div class="preview-option-text">${option.text}</div>
          </div>
        `).join('')}
      </div>
      <div class="preview-rationale">
        <div class="preview-rationale-title">Explanation:</div>
        <p>${correctOption ? correctOption.rationale : 'No explanation provided'}</p>
      </div>
    `;
    
    // Add event listeners
    questionElement.querySelector('.edit-question-btn').addEventListener('click', () => {
      editQuestion(question, index);
    });
    
    questionElement.querySelector('.regenerate-btn').addEventListener('click', () => {
      regenerateQuestionFromPreview(question.id);
    });
    
    container.appendChild(questionElement);
  });
}

// Edit a question
function editQuestion(question, index) {
  currentEditingQuestion = { ...question, index };
  
  // Populate edit modal
  document.getElementById('edit-question-text').value = question.text;
  
  // Render options
  renderEditOptions(question.options);
  
  // Find and populate rationale
  const correctOption = question.options.find(opt => opt.isCorrect);
  document.getElementById('edit-question-rationale').value = 
    correctOption ? correctOption.rationale : '';
  
  // Show modal
  showModal(document.getElementById('edit-question-modal'));
}

// Render edit options
function renderEditOptions(options) {
  const container = document.getElementById('edit-options-container');
  container.innerHTML = '';
  
  options.forEach((option, index) => {
    const optionElement = document.createElement('div');
    optionElement.className = 'option-item';
    
    optionElement.innerHTML = `
      <input type="radio" name="edit-correct" ${option.isCorrect ? 'checked' : ''}>
      <input type="text" class="option-text" value="${option.text}">
      <button class="remove-option-btn"><i class="fas fa-times"></i></button>
    `;
    
    // Add event listener to remove button
    optionElement.querySelector('.remove-option-btn').addEventListener('click', () => {
      optionElement.remove();
    });
    
    container.appendChild(optionElement);
  });
}

// Add a new option
function addQuestionOption() {
  const container = document.getElementById('edit-options-container');
  const optionElement = document.createElement('div');
  optionElement.className = 'option-item';
  
  optionElement.innerHTML = `
    <input type="radio" name="edit-correct">
    <input type="text" class="option-text" placeholder="Enter option text">
    <button class="remove-option-btn"><i class="fas fa-times"></i></button>
  `;
  
  // Add event listener to remove button
  optionElement.querySelector('.remove-option-btn').addEventListener('click', () => {
    optionElement.remove();
  });
  
  container.appendChild(optionElement);
}

// Save question changes
async function saveQuestionChanges() {
  if (!currentEditingQuestion) return;
  
  try {
    // Gather edited data
    const questionText = document.getElementById('edit-question-text').value;
    const rationale = document.getElementById('edit-question-rationale').value;
    
    // Get options
    const optionElements = document.querySelectorAll('#edit-options-container .option-item');
    const options = [];
    
    let hasCorrectOption = false;
    
    optionElements.forEach((element, index) => {
      const isCorrect = element.querySelector('input[type="radio"]').checked;
      const text = element.querySelector('input[type="text"]').value;
      
      if (isCorrect) {
        hasCorrectOption = true;
      }
      
      options.push({
        text,
        isCorrect,
        rationale: isCorrect ? rationale : ''
      });
    });
    
    // Validate
    if (!questionText) {
      alert('Question text is required');
      return;
    }
    
    if (options.length < 2) {
      alert('At least two options are required');
      return;
    }
    
    if (!hasCorrectOption) {
      alert('You must select a correct option');
      return;
    }
    
    // Update question
    const token = getTokenFromStorage();
    const response = await fetch(`/interac/api/quizzes/questions/${currentEditingQuestion.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        text: questionText,
        options
      })
    });
    
    if (!response.ok) {
      throw new Error('Failed to update question');
    }
    
    // Success
    hideModal(document.getElementById('edit-question-modal'));
    
    // If preview modal is open, refresh the preview
    if (document.getElementById('quiz-preview-modal').classList.contains('active')) {
      const quizId = currentEditingQuestion.quizId;
      previewQuiz(quizId);
    }
    
  } catch (error) {
    console.error('Error saving question:', error);
    alert('Failed to save question');
  }
}

// Regenerate a question with AI
async function regenerateQuestion() {
  if (!currentEditingQuestion) return;
  
  try {
    const token = getTokenFromStorage();
    
    // Get the quiz for context
    const quizResponse = await fetch(`/interac/api/quizzes/${currentEditingQuestion.quizId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!quizResponse.ok) {
      throw new Error('Failed to load quiz');
    }
    
    const quiz = await quizResponse.json();
    
 // Show loading state
 document.getElementById('regenerate-question-btn').disabled = true;
 document.getElementById('regenerate-question-btn').textContent = 'Regenerating...';
 
 // Generate a new question using AI
 const questionConfig = {
   topic: quiz.title,
   difficulty: 'medium', // Default to medium if not specified
   rationaleTone: 'educational', // Default to educational if not specified
   optionsPerQuestion: currentEditingQuestion.options.length,
   specificFocuses: [currentEditingQuestion.text] // Use current question as context
 };
 
 const newQuestion = await aiService.generateQuizQuestion(questionConfig.topic, questionConfig);
 
 // Update question
 const updateResponse = await fetch(`/interac/api/quizzes/questions/${currentEditingQuestion.id}`, {
   method: 'PUT',
   headers: {
     'Content-Type': 'application/json',
     'Authorization': `Bearer ${token}`
   },
   body: JSON.stringify(newQuestion)
 });
 
 if (!updateResponse.ok) {
   throw new Error('Failed to update question');
 }
 
 // Reset state
 document.getElementById('regenerate-question-btn').disabled = false;
 document.getElementById('regenerate-question-btn').textContent = 'Regenerate with AI';
 
 // Hide modal
 hideModal(document.getElementById('edit-question-modal'));
 
 // If preview modal is open, refresh the preview
 if (document.getElementById('quiz-preview-modal').classList.contains('active')) {
   previewQuiz(currentEditingQuestion.quizId);
 }
 
} catch (error) {
 console.error('Error regenerating question:', error);
 alert('Failed to regenerate question: ' + error.message);
 
 // Reset state
 document.getElementById('regenerate-question-btn').disabled = false;
 document.getElementById('regenerate-question-btn').textContent = 'Regenerate with AI';
}
}

// Regenerate a question from the preview
async function regenerateQuestionFromPreview(questionId) {
try {
 // Find the question
 const token = getTokenFromStorage();
 const response = await fetch(`/interac/api/quizzes/questions/${questionId}`, {
   headers: {
     'Authorization': `Bearer ${token}`
   }
 });
 
 if (!response.ok) {
   throw new Error('Failed to load question');
 }
 
 const question = await response.json();
 
 // Set as current editing question
 currentEditingQuestion = question;
 
 // Regenerate
 await regenerateQuestion();
 
} catch (error) {
 console.error('Error regenerating question:', error);
 alert('Failed to regenerate question');
}
}

// Publish quiz
async function publishQuiz() {
try {
 const quizId = document.getElementById('preview-quiz-name').dataset.quizId;
 
 if (!quizId) {
   throw new Error('Quiz ID not found');
 }
 
 const token = getTokenFromStorage();
 const response = await fetch(`/interac/api/quizzes/${quizId}/publish`, {
   method: 'PUT',
   headers: {
     'Authorization': `Bearer ${token}`
   }
 });
 
 if (!response.ok) {
   throw new Error('Failed to publish quiz');
 }
 
 // Success
 hideModal(document.getElementById('quiz-preview-modal'));
 
 // Refresh quiz list
 loadQuizzes();
 
} catch (error) {
 console.error('Error publishing quiz:', error);
 alert('Failed to publish quiz');
}
}

// Handle manual quiz creation
function handleManualQuizSubmit() {
// Implementation for manual quiz creation
alert('Manual quiz creation is not implemented yet');
}

// Add a manual question
function addManualQuestion() {
const questionsContainer = document.getElementById('questions-container');
const questionCount = questionsContainer.children.length + 1;

const questionElement = document.createElement('div');
questionElement.className = 'question-item';

questionElement.innerHTML = `
 <div class="question-header">
   <h3>Question ${questionCount}</h3>
   <button class="remove-question-btn"><i class="fas fa-trash"></i></button>
 </div>
 
 <div class="form-group">
   <label>Question Text</label>
   <textarea class="question-text" placeholder="Enter question text"></textarea>
 </div>
 
 <div class="options-container">
   <div class="option-item">
     <input type="radio" name="correct-${questionCount}" checked>
     <input type="text" class="option-text" placeholder="Option 1">
   </div>
   <div class="option-item">
     <input type="radio" name="correct-${questionCount}">
     <input type="text" class="option-text" placeholder="Option 2">
   </div>
   <div class="option-item">
     <input type="radio" name="correct-${questionCount}">
     <input type="text" class="option-text" placeholder="Option 3">
   </div>
   <div class="option-item">
     <input type="radio" name="correct-${questionCount}">
     <input type="text" class="option-text" placeholder="Option 4">
   </div>
 </div>
 
 <div class="form-group">
   <label>Rationale</label>
   <textarea class="question-rationale" placeholder="Explain why the correct answer is right"></textarea>
 </div>
`;

// Add event listener to remove button
questionElement.querySelector('.remove-question-btn').addEventListener('click', () => {
 questionElement.remove();
 
 // Update question numbers
 updateQuestionNumbers();
});

questionsContainer.appendChild(questionElement);
}

// Update question numbers after removing a question
function updateQuestionNumbers() {
const questions = document.querySelectorAll('#questions-container .question-item');

questions.forEach((question, index) => {
 question.querySelector('h3').textContent = `Question ${index + 1}`;
 
 // Update radio names
 const radios = question.querySelectorAll('input[type="radio"]');
 radios.forEach(radio => {
   radio.name = `correct-${index + 1}`;
 });
});
}

// Edit quiz
function editQuiz(quizId) {
// Implementation for editing a quiz
alert('Edit quiz functionality is not implemented yet');
}

// Delete quiz
async function deleteQuiz(quizId) {
if (!confirm('Are you sure you want to delete this quiz? This action cannot be undone.')) {
 return;
}

try {
 const token = getTokenFromStorage();
 const response = await fetch(`/interac/api/quizzes/${quizId}`, {
   method: 'DELETE',
   headers: {
     'Authorization': `Bearer ${token}`
   }
 });
 
 if (!response.ok) {
   throw new Error('Failed to delete quiz');
 }
 
 // Refresh quiz list
 loadQuizzes();
 
} catch (error) {
 console.error('Error deleting quiz:', error);
 alert('Failed to delete quiz');
}
}

// Show modal
function showModal(modal) {
modal.classList.add('active');
}

// Hide modal
function hideModal(modal) {
modal.classList.remove('active');
}
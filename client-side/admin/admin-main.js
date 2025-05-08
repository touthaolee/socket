// client-side/admin/admin-main.js
import { getTokenFromStorage } from '../client-utils/client-helpers.js';
import { aiService } from './service/ai-service.js';
import { similarityService } from './service/ai-similarity-service.js';
import adminChatService from './service/admin-chat-service.js';

/**
 * Utility function for debouncing
 * @param {Function} func - The function to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} - Debounced function
 */
function debounce(func, delay) {
  let timeoutId;
  return function(...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      func.apply(this, args);
    }, delay);
  };
}

// --- Admin Auth Logic ---
function showAdminLogin() {
  // Show login modal by adding active class
  const loginModal = document.getElementById('admin-login-container');
  loginModal.classList.add('active');
  loginModal.style.display = 'flex';
  
  // Hide admin container
  const adminContainer = document.querySelector('.admin-container');
  adminContainer.style.display = 'none';
  
  console.log('Login form displayed');
}

function showAdminDashboard() {
  // Hide login modal
  const loginModal = document.getElementById('admin-login-container');
  loginModal.classList.remove('active');
  loginModal.style.display = 'none';
  
  // Show admin container
  const adminContainer = document.querySelector('.admin-container');
  adminContainer.style.display = 'block';
  
  // Make sure at least one view is visible on dashboard show
  const activeView = document.querySelector('.admin-view.active');
  if (!activeView) {
    // If no view is active, activate the first one
    const firstView = document.querySelector('.admin-view');
    const firstMenuItem = document.querySelector('.menu-item');
    if (firstView) firstView.classList.add('active');
    if (firstMenuItem) firstMenuItem.classList.add('active');
  }
}

// Check for token on page load
const token = getTokenFromStorage();
console.log('Auth token check on page load');

// Simple authentication check
if (!token) {
  showAdminLogin();
} else {
  // Try to load quizzes as a way to verify token is valid
  checkTokenAndShowDashboard();
}

// Function to verify token by making an authenticated API request
async function checkTokenAndShowDashboard() {
  try {
    // Attempt to get quizzes - this will fail if token is invalid
    const response = await fetch('/interac/api/quiz/quizzes', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (response.ok) {
      showAdminDashboard();
      // Initialize admin UI only after authentication is confirmed
      initAdminUI();
      loadQuizzes();
    } else {
      // Token is invalid or expired
      console.log('Token validation failed - showing login form');
      localStorage.removeItem('auth_token'); // Clear invalid token
      showAdminLogin();
    }
  } catch (error) {
    console.error('Authentication error:', error);
    showAdminLogin();
  }
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
        initAdminUI();
        loadQuizzes();
      } else {
        errorDiv.textContent = data.error || 'Login failed';
      }
    } catch (err) {
      console.error('Login error:', err);
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

// Initialize admin UI
function initAdminUI() {
  // Setup navigation
  setupNavigation();
  
  // Setup modal handlers
  setupModalHandlers();
  
  // Setup quiz management
  setupQuizManagement();
  
  // Initialize chat functionality
  initAdminChat();
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
  
  // Ensure a default view is active
  if (menuItems.length > 0 && views.length > 0) {
    if (!document.querySelector('.menu-item.active')) {
      menuItems[0].classList.add('active');
    }
    if (!document.querySelector('.admin-view.active')) {
      views[0].classList.add('active');
    }
  }
  
  // Logout button
  document.getElementById('logout-btn').addEventListener('click', () => {
    localStorage.removeItem('auth_token');
    showAdminLogin();
  });
}

// Load quizzes - also serves as a token verification method
async function loadQuizzes() {
  try {
    const token = getTokenFromStorage();
    if (!token) {
      showAdminLogin();
      return;
    }
    
    const response = await fetch('/interac/api/quiz/quizzes?page=' + currentPage, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      // If unauthorized (401), show login form
      if (response.status === 401) {
        console.log('Token expired or invalid');
        localStorage.removeItem('auth_token');
        showAdminLogin();
        return;
      }
      throw new Error('Failed to load quizzes');
    }
    
    const data = await response.json();
    quizzes = data.quizzes || [];
    totalPages = data.totalPages || 1;
    
    renderQuizzes();
    updatePagination();
  } catch (error) {
    console.error('Error loading quizzes:', error);
    // Show error message
  }
}

// Initialize admin chat functionality
function initAdminChat() {
  try {
    // Get logged in user info from JWT token (if available)
    const token = getTokenFromStorage();
    if (!token) return;
    
    // For simplicity, we'll use a fixed admin username
    const adminUsername = 'Admin';
    const adminUserId = 'admin_' + Date.now();
    
    // Initialize the chat service
    adminChatService.init(adminUsername, adminUserId);
    
    // Set up UI event listeners
    setupChatUIEventListeners();
    
    // Set up event handlers for the chat service
    setupChatEventHandlers();
    
    console.log('Admin chat initialized');
  } catch (error) {
    console.error('Error initializing admin chat:', error);
  }
}

// Set up UI event listeners for the chat interface
function setupChatUIEventListeners() {
  // Send message button
  const sendMessageBtn = document.getElementById('send-message-btn');
  if (sendMessageBtn) {
    sendMessageBtn.addEventListener('click', sendChatMessage);
  }
  
  // Send message on Enter key (but allow Shift+Enter for new line)
  const chatInput = document.getElementById('chat-input');
  if (chatInput) {
    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendChatMessage();
      }
    });
  }
}

// Send a chat message
function sendChatMessage() {
  const chatInput = document.getElementById('chat-input');
  if (!chatInput) return;
  
  const messageText = chatInput.value.trim();
  if (!messageText) return;
  
  // Send message using chat service
  adminChatService.sendMessage(messageText);
  
  // Clear input
  chatInput.value = '';
  chatInput.focus();
}

// Setup event handlers for the chat service events
function setupChatEventHandlers() {
  // When users list is updated
  adminChatService.on('usersUpdated', ({ users, onlineUsers }) => {
    updateUsersList(users, onlineUsers);
  });
  
  // When messages are received
  adminChatService.on('messageReceived', ({ messages }) => {
    updateChatMessages(messages);
  });
  
  // When connection status changes
  adminChatService.on('connectionUpdated', ({ connected }) => {
    updateConnectionStatus(connected);
  });
}

// Update the connection status in the UI
function updateConnectionStatus(connected) {
  const statusIndicator = document.getElementById('connection-status');
  if (statusIndicator) {
    if (connected) {
      statusIndicator.classList.remove('offline');
      statusIndicator.classList.add('online');
      statusIndicator.title = 'Connected to chat server';
    } else {
      statusIndicator.classList.remove('online');
      statusIndicator.classList.add('offline');
      statusIndicator.title = 'Disconnected from chat server';
    }
  }
}

// Update the users list in the UI
function updateUsersList(users, onlineCount) {
  const userList = document.getElementById('online-users-list');
  const onlineCountElement = document.getElementById('online-count');
  
  if (userList) {
    userList.innerHTML = '';
    
    if (!Array.isArray(users) || users.length === 0) {
      userList.innerHTML = `
        <div class="user-pill">No users online</div>
      `;
    } else {
      users.forEach(user => {
        // Enhanced user identification
        let userId, username, userStatus;
        
        if (typeof user === 'object' && user !== null) {
          // Handle object format with proper property fallbacks
          userId = user.userId || user.id || 'unknown';
          username = user.username || user.name || 'Anonymous';
          userStatus = user.status || 'online';
        } else if (typeof user === 'string') {
          // Handle string format (older API)
          userId = 'user_' + user;
          username = user;
          userStatus = 'online';
        } else {
          // Handle unexpected format with better logging
          console.warn('Unexpected user format:', user);
          userId = 'unknown_' + Date.now();
          username = 'Unknown User';
          userStatus = 'online';
        }
        
        userList.innerHTML += `
          <div class="user-pill ${userStatus}" data-user-id="${userId}" title="${username} (${userStatus})">
            ${username}
          </div>
        `;
      });
      
      // Add click handlers for direct messaging
      const userPills = userList.querySelectorAll('.user-pill');
      userPills.forEach(pill => {
        pill.addEventListener('click', () => {
          const userId = pill.dataset.userId;
          adminChatService.setSelectedUser(userId);
          
          // Update UI to show selected user
          userPills.forEach(p => p.classList.remove('selected'));
          pill.classList.add('selected');
          
          // Update chat input placeholder
          const chatInput = document.getElementById('chat-input');
          if (chatInput) {
            chatInput.placeholder = `Message to ${pill.textContent.trim()}...`;
          }
        });
      });
    }
  }
  
  if (onlineCountElement) {
    onlineCountElement.textContent = Array.isArray(users) ? users.length : (onlineCount || 0);
  }
}

// Update the chat messages in the UI
function updateChatMessages(messages) {
  const chatMessages = document.getElementById('chat-messages');
  if (!chatMessages) return;
  
  chatMessages.innerHTML = '';
  
  if (messages.length === 0) {
    chatMessages.innerHTML = `
      <div class="system-message">
        <div class="message-content">
          No messages yet. Be the first to say hello!
        </div>
      </div>
    `;
    return;
  }
  
  messages.forEach(message => {
    if (message.isSystem) {
      // System message
      chatMessages.innerHTML += `
        <div class="system-message">
          <div class="message-content">
            ${message.text}
          </div>
        </div>
      `;
    } else {
      // User message
      const time = new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const isSelf = message.isSelf;
      
      chatMessages.innerHTML += `
        <div class="message ${isSelf ? 'message-self' : ''}" data-message-id="${message.id}">
          <div class="message-content-wrapper">
            <div class="message-header">
              <span class="message-sender">${message.username}</span>
              <span class="message-time">${time}</span>
            </div>
            <div class="message-content">
              ${message.text}
            </div>
          </div>
        </div>
      `;
    }
  });
  
  // Scroll to bottom
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Setup modal handlers
function setupModalHandlers() {
  // Create quiz modal
  const createQuizBtn = document.getElementById('create-quiz-btn');
  const createQuizModal = document.getElementById('create-quiz-modal');
  const closeModalBtn = document.querySelector('.close-modal');
  const cancelCreateBtn = document.getElementById('cancel-create-btn');
  
  console.log('Setting up modal handlers');
  console.log('Create Quiz Button found:', !!createQuizBtn);
  console.log('Create Quiz Modal found:', !!createQuizModal);
  
  if (createQuizBtn && createQuizModal) {
    createQuizBtn.addEventListener('click', function() {
      console.log('Create Quiz Button clicked');
      
      // Set both display and add active class to ensure visibility
      createQuizModal.style.display = 'flex';
      
      // Force browser reflow
      void createQuizModal.offsetWidth;
      
      // Add custom class for additional styling if needed
      createQuizModal.classList.add('active');
      
      console.log('Modal display style set to:', createQuizModal.style.display);
      console.log('Modal classList:', createQuizModal.className);
    });
  }
  
  // Close modal buttons
  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', function() {
      console.log('Close modal button clicked');
      if (createQuizModal) {
        createQuizModal.classList.remove('active');
        createQuizModal.style.display = 'none';
      }
    });
  }
  
  if (cancelCreateBtn) {
    cancelCreateBtn.addEventListener('click', function() {
      console.log('Cancel create button clicked');
      if (createQuizModal) {
        createQuizModal.classList.remove('active');
        createQuizModal.style.display = 'none';
      }
    });
  }
  
  // Form tabs in create quiz modal
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabName = btn.dataset.tab;
      
      // Update active tab button
      tabBtns.forEach(tb => tb.classList.remove('active'));
      btn.classList.add('active');
      
      // Show corresponding tab content
      tabContents.forEach(content => {
        if (content.id === `${tabName}-form`) {
          content.classList.add('active');
        } else {
          content.classList.remove('active');
        }
      });
    });
  });
  
  // Advanced options toggle
  const advancedOptions = document.getElementById('advanced-options');
  if (advancedOptions) {
    advancedOptions.previousElementSibling.addEventListener('click', () => {
      advancedOptions.classList.toggle('expanded');
    });
  }
  
  // Quiz Preview Modal
  const closePreviewModalBtn = document.querySelector('.close-preview-modal');
  const quizPreviewModal = document.getElementById('quiz-preview-modal');
  
  if (closePreviewModalBtn && quizPreviewModal) {
    closePreviewModalBtn.addEventListener('click', () => {
      quizPreviewModal.style.display = 'none';
    });
  }
  
  // Edit Question Modal
  const closeEditModalBtn = document.querySelector('.close-edit-modal');
  const editQuestionModal = document.getElementById('edit-question-modal');
  
  if (closeEditModalBtn && editQuestionModal) {
    closeEditModalBtn.addEventListener('click', () => {
      editQuestionModal.style.display = 'none';
    });
  }
  
  // Similarity Check Modal
  const closeSimilarityModalBtn = document.querySelector('.close-similarity-modal');
  const similarityCheckModal = document.getElementById('similarity-check-modal');
  const closeSimilarityBtn = document.getElementById('close-similarity-btn');
  
  if (closeSimilarityModalBtn && similarityCheckModal) {
    closeSimilarityModalBtn.addEventListener('click', () => {
      similarityCheckModal.style.display = 'none';
    });
  }
  
  if (closeSimilarityBtn && similarityCheckModal) {
    closeSimilarityBtn.addEventListener('click', () => {
      similarityCheckModal.style.display = 'none';
    });
  }
  
  // Close modals when clicking outside
  window.addEventListener('click', (e) => {
    if (e.target === createQuizModal) createQuizModal.style.display = 'none';
    if (e.target === quizPreviewModal) quizPreviewModal.style.display = 'none';
    if (e.target === editQuestionModal) editQuestionModal.style.display = 'none';
    if (e.target === similarityCheckModal) similarityCheckModal.style.display = 'none';
  });
}

// Setup quiz management
function setupQuizManagement() {
  // Quiz pagination
  const prevPageBtn = document.getElementById('prev-page');
  const nextPageBtn = document.getElementById('next-page');
  
  if (prevPageBtn) {
    prevPageBtn.addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage--;
        loadQuizzes();
      }
    });
  }
  
  if (nextPageBtn) {
    nextPageBtn.addEventListener('click', () => {
      if (currentPage < totalPages) {
        currentPage++;
        loadQuizzes();
      }
    });
  }
  
  // Quiz search
  const quizSearch = document.getElementById('quiz-search');
  if (quizSearch) {
    quizSearch.addEventListener('input', debounce(() => {
      // Reset to first page when searching
      currentPage = 1;
      loadQuizzes();
    }, 300));
  }
  
  // Quiz filter
  const quizFilter = document.getElementById('quiz-filter');
  if (quizFilter) {
    quizFilter.addEventListener('change', () => {
      // Reset to first page when filtering
      currentPage = 1;
      loadQuizzes();
    });
  }
  
  // Create quiz submit
  const createQuizSubmitBtn = document.getElementById('create-quiz-submit-btn');
  if (createQuizSubmitBtn) {
    createQuizSubmitBtn.addEventListener('click', createQuiz);
  }
}

// Render quizzes to the table
function renderQuizzes() {
  const quizzesTable = document.getElementById('quizzes-table').querySelector('tbody');
  if (!quizzesTable) return;
  
  quizzesTable.innerHTML = '';
  
  if (quizzes.length === 0) {
    quizzesTable.innerHTML = `
      <tr>
        <td colspan="5" class="empty-state">No quizzes found</td>
      </tr>
    `;
    return;
  }
  
  quizzes.forEach(quiz => {
    const createdDate = new Date(quiz.createdAt).toLocaleDateString();
    const statusClass = quiz.status === 'active' ? 'status-active' : 'status-draft';
    
    quizzesTable.innerHTML += `
      <tr data-quiz-id="${quiz.id}">
        <td>${quiz.name}</td>
        <td>${quiz.questions ? quiz.questions.length : 0}</td>
        <td>${createdDate}</td>
        <td><span class="status-badge ${statusClass}">${quiz.status}</span></td>
        <td class="actions-cell">
          <button class="action-btn view-btn" title="View Quiz"><i class="fas fa-eye"></i></button>
          <button class="action-btn edit-btn" title="Edit Quiz"><i class="fas fa-edit"></i></button>
          <button class="action-btn delete-btn" title="Delete Quiz"><i class="fas fa-trash"></i></button>
        </td>
      </tr>
    `;
  });
  
  // Add click handlers to action buttons
  const viewButtons = quizzesTable.querySelectorAll('.view-btn');
  const editButtons = quizzesTable.querySelectorAll('.edit-btn');
  const deleteButtons = quizzesTable.querySelectorAll('.delete-btn');
  
  viewButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const quizId = e.target.closest('tr').dataset.quizId;
      viewQuiz(quizId);
    });
  });
  
  editButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const quizId = e.target.closest('tr').dataset.quizId;
      editQuiz(quizId);
    });
  });
  
  deleteButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const quizId = e.target.closest('tr').dataset.quizId;
      deleteQuiz(quizId);
    });
  });
}

// Update pagination info
function updatePagination() {
  const pageInfo = document.getElementById('page-info');
  if (pageInfo) {
    pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
  }
  
  const prevPageBtn = document.getElementById('prev-page');
  const nextPageBtn = document.getElementById('next-page');
  
  if (prevPageBtn) {
    prevPageBtn.disabled = currentPage <= 1;
  }
  
  if (nextPageBtn) {
    nextPageBtn.disabled = currentPage >= totalPages;
  }
}

// Create a new quiz
async function createQuiz() {
  // Get quiz data from form
  const activeTab = document.querySelector('.tab-btn.active').dataset.tab;
  let quizData;
  
  if (activeTab === 'ai-generate') {
    const quizName = document.getElementById('quiz-name').value.trim();
    const aiTopic = document.getElementById('ai-topic').value.trim();
    
    quizData = {
      name: quizName,
      description: document.getElementById('quiz-description').value.trim(),
      timePerQuestion: parseInt(document.getElementById('time-per-question').value) || 30,
      aiOptions: {
        topic: aiTopic,
        numQuestions: parseInt(document.getElementById('num-questions').value) || 10,
        difficulty: document.getElementById('difficulty').value,
        rationaleTone: document.getElementById('rationale-tone').value,
        optionsPerQuestion: parseInt(document.getElementById('options-per-question').value) || 4,
        batchSize: parseInt(document.getElementById('batch-size').value) || 5,
        specificFocuses: document.getElementById('specific-focuses').value.trim()
      }
    };
    
    // Validate with specific error messages
    if (!quizName) {
      alert('Please enter a quiz name');
      document.getElementById('quiz-name').focus();
      return;
    }
    
    if (!aiTopic) {
      alert('Please enter an AI topic in the "Topic/Prompt" field to generate questions');
      document.getElementById('ai-topic').focus();
      return;
    }
    
    // Start generation
    startQuizGeneration(quizData);
  } else {
    // Manual creation
    const quizName = document.getElementById('manual-quiz-name').value.trim();
    const questions = getQuestionsFromForm();
    
    quizData = {
      name: quizName,
      description: document.getElementById('manual-quiz-description').value.trim(),
      timePerQuestion: parseInt(document.getElementById('manual-time-per-question').value) || 30,
      questions: questions
    };
    
    // Validate with specific error messages
    if (!quizName) {
      alert('Please enter a quiz name');
      document.getElementById('manual-quiz-name').focus();
      return;
    }
    
    if (questions.length === 0) {
      alert('Please add at least one question with options and a correct answer');
      return;
    }
    
    // Create quiz
    await saveQuiz(quizData);
  }
}

// Get questions from the manual create form
function getQuestionsFromForm() {
  const questions = [];
  const questionItems = document.querySelectorAll('.question-item');
  
  questionItems.forEach((item, index) => {
    const questionText = item.querySelector('.question-text').value.trim();
    const rationale = item.querySelector('.question-rationale').value.trim();
    const options = [];
    let correctIndex = -1;
    
    const optionItems = item.querySelectorAll('.option-item');
    optionItems.forEach((optionItem, optIndex) => {
      const optionText = optionItem.querySelector('.option-text').value.trim();
      const isCorrect = optionItem.querySelector('input[type="radio"]').checked;
      
      if (optionText) {
        options.push(optionText);
        if (isCorrect) {
          correctIndex = optIndex;
        }
      }
    });
    
    if (questionText && options.length >= 2 && correctIndex !== -1) {
      questions.push({
        text: questionText,
        options,
        correctIndex,
        rationale
      });
    }
  });
  
  return questions;
}

// Start AI quiz generation
function startQuizGeneration(quizData) {
  // Show generation progress modal
  const progressModal = document.getElementById('generation-progress-modal');
  if (progressModal) {
    progressModal.style.display = 'flex';
  }
  
  // Reset cancellation flag
  generationCancelled = false;
  
  // Start tracking generation time
  const startTime = Date.now();
  let elapsedTimeInterval;
  
  // Update elapsed time display
  function updateElapsedTime() {
    const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
    const minutes = Math.floor(elapsedSeconds / 60);
    const seconds = elapsedSeconds % 60;
    document.getElementById('elapsed-time').textContent = 
      `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  
  // Start updating elapsed time
  elapsedTimeInterval = setInterval(updateElapsedTime, 1000);
  
  // Setup cancel button
  const cancelBtn = document.getElementById('cancel-generation-btn');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      generationCancelled = true;
      addLogEntry('Generation cancelled by user');
    }, { once: true });
  }
  
  // Helper function to add log entries
  function addLogEntry(text, isError = false) {
    const logContainer = document.getElementById('generation-log-container');
    if (logContainer) {
      const entryElement = document.createElement('div');
      entryElement.className = `log-entry${isError ? ' log-error' : ''}`;
      entryElement.textContent = text;
      logContainer.appendChild(entryElement);
      logContainer.scrollTop = logContainer.scrollHeight;
    }
  }
  
  // Add initial log entry
  addLogEntry('Starting quiz generation for topic: ' + quizData.aiOptions.topic);
  addLogEntry('Connecting to AI service...');
  
  // Generate questions in batches
  generateQuizQuestions(quizData, {
    onProgress: (progress, generatedCount, totalCount) => {
      // Update progress bar
      document.getElementById('generation-progress-fill').style.width = `${progress}%`;
      document.getElementById('generation-progress-text').textContent = `${Math.round(progress)}%`;
      document.getElementById('questions-generated').textContent = `${generatedCount}/${totalCount}`;
      
      // Update estimated time remaining
      if (generatedCount > 0) {
        const elapsedTime = (Date.now() - startTime) / 1000;
        const timePerQuestion = elapsedTime / generatedCount;
        const remainingQuestions = totalCount - generatedCount;
        const remainingSeconds = Math.round(timePerQuestion * remainingQuestions);
        
        const remainingMinutes = Math.floor(remainingSeconds / 60);
        const seconds = remainingSeconds % 60;
        document.getElementById('estimated-time').textContent = 
          `${remainingMinutes}m ${seconds}s`;
      }
    },
    onBatchComplete: (batch, batchNumber, totalBatches) => {
      const hasMockQuestions = batch.some(q => q.text.includes('Sample question about'));
      if (hasMockQuestions) {
        addLogEntry(`Batch ${batchNumber}/${totalBatches} complete with fallback questions due to server issues`, true);
      } else {
        addLogEntry(`Batch ${batchNumber}/${totalBatches} complete: ${batch.length} questions generated`);
      }
    },
    onComplete: async (questions) => {
      const mockCount = questions.filter(q => q.text.includes('Sample question about')).length;
      if (mockCount > 0) {
        addLogEntry(`Generation complete: ${questions.length} questions generated (${mockCount} fallback questions due to server issues)`, mockCount === questions.length);
      } else {
        addLogEntry(`Generation complete: ${questions.length} questions generated`);
      }
      
      // Clean up
      clearInterval(elapsedTimeInterval);
      
      // Add completion message that stands out
      const completionMsg = document.createElement('div');
      completionMsg.className = 'log-entry log-success';
      completionMsg.style.fontWeight = 'bold';
      completionMsg.style.padding = '15px';
      completionMsg.style.margin = '15px 0';
      completionMsg.style.backgroundColor = '#d4edda';
      completionMsg.style.color = '#155724';
      completionMsg.style.borderRadius = '4px';
      completionMsg.style.textAlign = 'center';
      completionMsg.style.border = '2px solid #28a745';
      completionMsg.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
      completionMsg.textContent = '✅ Quiz generation completed! Click the button below to save your quiz:';
      
      // Add option to continue with the generated questions
      const generateAgainBtn = document.createElement('button');
      generateAgainBtn.className = 'btn-outline';
      generateAgainBtn.textContent = 'Try Generating Again';
      generateAgainBtn.style.marginRight = '10px';
      
      const continueBtn = document.createElement('button');
      continueBtn.className = 'btn';
      continueBtn.innerHTML = '<i class="fas fa-save"></i> SAVE QUIZ';
      continueBtn.style.fontWeight = 'bold';
      continueBtn.style.backgroundColor = '#28a745';
      continueBtn.style.color = 'white';
      continueBtn.style.padding = '12px 24px';
      continueBtn.style.fontSize = '16px';
      continueBtn.style.animation = 'pulse 2s infinite';
      
      // Add animation style
      const style = document.createElement('style');
      style.textContent = `
        @keyframes pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.05); }
          100% { transform: scale(1); }
        }
      `;
      document.head.appendChild(style);
      
      const actionContainer = document.createElement('div');
      actionContainer.className = 'generation-actions';
      actionContainer.style.marginTop = '20px';
      actionContainer.style.display = 'flex';
      actionContainer.style.justifyContent = 'center';
      actionContainer.style.gap = '15px';
      
      // Add the completion message
      const logContainer = document.getElementById('generation-log-container');
      if (logContainer) {
        logContainer.appendChild(completionMsg);
      }
      
      // Always add both buttons, but disable the "try again" if no mock questions
      if (mockCount > 0) {
        actionContainer.appendChild(generateAgainBtn);
      }
      actionContainer.appendChild(continueBtn);
      
      if (logContainer) {
        logContainer.appendChild(actionContainer);
      }
      
      // Handle try again button
      generateAgainBtn.addEventListener('click', () => {
        // Hide the action buttons
        actionContainer.style.display = 'none';
        
        // Start generation again
        addLogEntry('Retrying generation...');
        startQuizGeneration(quizData);
      });
      
      // Handle continue button - make sure this works!
      continueBtn.addEventListener('click', async () => {
        // Show a saving message
        addLogEntry('Saving quiz...');
        
        // Create final quiz object
        const finalQuizData = {
          ...quizData,
          questions,
          status: 'draft',
          createdAt: new Date().toISOString()
        };
        
        // Hide progress modal
        if (progressModal) {
          progressModal.style.display = 'none';
        }
        
        // Delete the AI options before saving
        delete finalQuizData.aiOptions;
        
        // Save the quiz and handle the result
        try {
          await saveQuiz(finalQuizData);
          // Show success alert after saving
          alert('Quiz created successfully!');
        } catch (error) {
          console.error('Error saving quiz:', error);
          // If there's an error, show the modal again with the error
          if (progressModal) {
            progressModal.style.display = 'flex';
          }
          addLogEntry(`Error saving quiz: ${error.message}`, true);
        }
      });
    },
    onError: (error) => {
      addLogEntry(`Error: ${error.message}`, true);
      
      // Add a retry button
      const retryBtn = document.createElement('button');
      retryBtn.className = 'btn';
      retryBtn.textContent = 'Retry Generation';
      retryBtn.style.marginTop = '15px';
      
      const logContainer = document.getElementById('generation-log-container');
      if (logContainer) {
        logContainer.appendChild(retryBtn);
      }
      
      retryBtn.addEventListener('click', () => {
        // Hide the retry button
        retryBtn.style.display = 'none';
        
        // Start generation again
        addLogEntry('Retrying generation...');
        startQuizGeneration(quizData);
      });
      
      // Clean up
      clearInterval(elapsedTimeInterval);
    }
  });
}

// Generate quiz questions using AI service
function generateQuizQuestions(quizData, callbacks) {
  const { onProgress, onBatchComplete, onComplete, onError } = callbacks;
  const { aiOptions } = quizData;
  
  // Helper function to check if generation should continue
  const shouldContinue = () => !generationCancelled;
  
  // Debug the aiService to ensure it's properly loaded
  console.log('AI Service object:', aiService);
  console.log('generateQuizQuestions function exists:', typeof aiService.generateQuizQuestions === 'function');
  
  // Safely call the method with a fallback implementation if needed
  if (typeof aiService.generateQuizQuestions === 'function') {
    // Use the existing method from the service
    aiService.generateQuizQuestions({
      topic: aiOptions.topic,
      numQuestions: aiOptions.numQuestions,
      difficulty: aiOptions.difficulty,
      optionsPerQuestion: aiOptions.optionsPerQuestion,
      rationaleTone: aiOptions.rationaleTone,
      specificFocuses: aiOptions.specificFocuses,
      batchSize: aiOptions.batchSize
    }, {
      onProgress,
      onBatchComplete,
      onComplete,
      onError,
      shouldContinue
    });
  } else {
    // Fallback implementation
    console.warn('aiService.generateQuizQuestions not found, using fallback implementation');
    
    // Implement a basic version in-place to handle the generation
    (async function() {
      try {
        const batchSize = aiOptions.batchSize || 5;
        const totalQuestions = aiOptions.numQuestions;
        const totalBatches = Math.ceil(totalQuestions / batchSize);
        let generatedQuestions = [];
        let currentBatch = 1;
        let generatedCount = 0;
        
        // Report initial progress
        onProgress(0, 0, totalQuestions);
        
        // Process in batches
        while (generatedCount < totalQuestions) {
          // Check if we should continue
          if (!shouldContinue()) {
            onError(new Error('Generation cancelled by user'));
            return;
          }
          
          // Calculate how many to generate in this batch
          const batchCount = Math.min(batchSize, totalQuestions - generatedCount);
          
          try {
            // Generate batch using the lower-level API
            console.log(`Generating batch ${currentBatch}/${totalBatches} (${batchCount} questions)...`);
            
            // Use the available generateQuestions method instead
            const batchQuestions = await aiService.generateQuestions(
              aiOptions.topic,
              batchCount,
              {
                difficulty: aiOptions.difficulty,
                rationaleTone: aiOptions.rationaleTone,
                optionsPerQuestion: aiOptions.optionsPerQuestion,
                specificFocuses: aiOptions.specificFocuses ? 
                  aiOptions.specificFocuses.split(',').map(f => f.trim()) : []
              }
            );
            
            // Add to results
            generatedQuestions = generatedQuestions.concat(batchQuestions);
            generatedCount += batchQuestions.length;
            
            // Report progress
            onProgress(
              (generatedCount / totalQuestions) * 100,
              generatedCount,
              totalQuestions
            );
            
            // Report batch completion
            onBatchComplete(batchQuestions, currentBatch, totalBatches);
            
            currentBatch++;
          } catch (error) {
            console.error(`Error in batch ${currentBatch}:`, error);
            // Continue with next batch despite errors
          }
          
          // Small delay between batches
          await new Promise(resolve => setTimeout(resolve, 300));
        }
        
        // Complete
        onComplete(generatedQuestions);
      } catch (error) {
        console.error('Error in fallback quiz generation:', error);
        onError(error);
      }
    })();
  }
}

// Save quiz to server
async function saveQuiz(quizData) {
  try {
    const token = getTokenFromStorage();
    if (!token) {
      showAdminLogin();
      return;
    }
    
    const response = await fetch('/interac/api/quiz/quizzes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(quizData)
    });
    
    if (!response.ok) {
      throw new Error('Failed to save quiz');
    }
    
    // Close create quiz modal
    const createQuizModal = document.getElementById('create-quiz-modal');
    if (createQuizModal) {
      createQuizModal.style.display = 'none';
    }
    
    // Reload quizzes
    loadQuizzes();
    
    // Show success message
    alert('Quiz created successfully');
  } catch (error) {
    console.error('Error saving quiz:', error);
    alert('Error saving quiz: ' + error.message);
  }
}
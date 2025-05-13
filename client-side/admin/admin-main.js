// client-side/admin/admin-main.js
import { getTokenFromStorage } from '../client-utils/client-helpers.js';
import { aiService } from './service/ai-service.js';
import { similarityService } from './service/ai-similarity-service.js';
import adminChatService from './service/admin-chat-service.js';
import { viewQuiz, editQuiz, deleteQuiz, publishQuiz, updateQuizzes } from './quiz-functions.js';

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
let currentEditingQuestion = null;

// Initialize admin UI
function initAdminUI() {
  // Make loadQuizzes function available globally
  window.loadQuizzes = loadQuizzes;
  
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
// Make loadQuizzes globally available so it can be called from quiz-designer.js
window.loadQuizzes = async function() {
  try {
    console.log('Global loadQuizzes function called');
    const token = getTokenFromStorage();
    if (!token) {
      showAdminLogin();
      return;
    }
    
    console.log('Loading quizzes, page:', currentPage);
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
    }    const data = await response.json();
    console.log('Loaded quizzes data:', data);
    
    // Normalize the quizzes data
    const loadedQuizzes = data.quizzes || [];
    
    // Ensure each quiz has an ID and required properties
    quizzes = loadedQuizzes.map(quiz => {
      return {
        id: quiz.id || quiz._id,
        name: quiz.name || quiz.title || 'Untitled Quiz',
        title: quiz.title || quiz.name || 'Untitled Quiz',
        description: quiz.description || '',
        questions: quiz.questions || [],
        timePerQuestion: quiz.timePerQuestion || 30,
        status: quiz.status || 'draft',
        createdAt: quiz.createdAt || new Date().toISOString()
      };
    });
    
    console.log('Normalized quizzes array:', quizzes);
    totalPages = data.totalPages || 1;
    
    // Update quizzes reference in quiz-functions.js
    updateQuizzes(quizzes);
    
    renderQuizzes();
    updatePagination();
  } catch (error) {
    console.error('Error loading quizzes:', error);
    // Show error message
  }
}

// Local reference for internal use
const loadQuizzes = window.loadQuizzes;

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
}

// Render quizzes to the table
function renderQuizzes() {
  const quizzesTable = document.getElementById('quizzes-table').querySelector('tbody');
  if (!quizzesTable) {
    console.error('Quiz table not found in DOM');
    return;
  }
  
  console.log('Rendering quizzes:', quizzes);
  quizzesTable.innerHTML = '';
  
  if (!quizzes || quizzes.length === 0) {
    console.log('No quizzes to display, checking if we need to load from server');
    
    // Try to directly load from server if we're not showing any quizzes
    fetchQuizzesDirectlyFromServer().then(loadedQuizzes => {
      if (loadedQuizzes && loadedQuizzes.length > 0) {
        console.log('Successfully loaded quizzes directly from server:', loadedQuizzes);
        quizzes = loadedQuizzes;
        renderQuizzes(); // Recursive call, but with loaded quizzes
        return;
      } else {
        console.log('No quizzes found even from direct server fetch');
        quizzesTable.innerHTML = `
          <tr>
            <td colspan="5" class="empty-state">No quizzes found. Click "Create Quiz" to add one.</td>
          </tr>
        `;
      }
    }).catch(err => {
      console.error('Error loading quizzes directly:', err);
      quizzesTable.innerHTML = `
        <tr>
          <td colspan="5" class="empty-state">No quizzes found. Click "Create Quiz" to add one.</td>
        </tr>
      `;
    });
    return;
  }
  quizzes.forEach(quiz => {
    console.log('Processing quiz for display:', quiz);
    const createdDate = new Date(quiz.createdAt).toLocaleDateString();
    
    // Handle various status conditions with better logging
    let statusText = quiz.status || 'draft';
    let statusClass = 'status-draft';
    
    console.log(`Quiz ${quiz.id} status: "${statusText}"`);
    
    if (statusText === 'published' || statusText === 'active') {
      statusClass = 'status-active';
      statusText = 'active';
    }
    
    const questionCount = Array.isArray(quiz.questions) ? quiz.questions.length : 0;
    const quizTitle = quiz.name || quiz.title || 'Untitled Quiz';
    
    console.log('Rendering quiz:', {
      id: quiz.id,
      title: quizTitle,
      questions: questionCount,
      status: statusText
    });
    
    quizzesTable.innerHTML += `
      <tr data-quiz-id="${quiz.id}">
        <td>${quiz.name || quiz.title}</td>
        <td>${questionCount}</td>
        <td>${createdDate}</td>
        <td><span class="status-badge ${statusClass}">${statusText}</span></td>
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

// Quiz creation functionality has been moved to the new quiz-designer.js module

// Define a function to save quizzes
async function saveQuiz(quizData) {
  try {
    console.log('Saving quiz data:', quizData);
    
    const token = getTokenFromStorage();
    if (!token) {
      console.error('No auth token found!');
      throw new Error('No authentication token found');
    }
    
    // Format the quiz data for the server API
    const serverQuizData = {
      title: quizData.name,
      description: quizData.description || '',
      questions: quizData.questions.map(q => ({
        text: q.text,
        options: Array.isArray(q.options) ? 
          q.options.map((opt, index) => ({
            text: typeof opt === 'string' ? opt : opt.text,
            isCorrect: typeof opt === 'string' ? 
              (index === q.correctIndex) : 
              opt.isCorrect
          })) : []
      })),
      timePerQuestion: quizData.timePerQuestion || 30,
      status: quizData.status || 'draft'
    };
    
    const response = await fetch('/interac/api/quiz/quizzes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(serverQuizData)
    });
    
    if (!response.ok) {
      const responseText = await response.text();
      throw new Error('Failed to save quiz: ' + responseText);
    }
    
    // Parse the response
    const responseText = await response.text();
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch (parseError) {
      console.warn('Could not parse response as JSON:', parseError);
    }
    
    // Reload the quiz list
    await loadQuizzes();
    alert('Quiz saved successfully!');
    return responseData;
  } catch (error) {
    console.error('Failed to save quiz:', error);
    alert('Failed to save quiz: ' + error.message);
    throw error;
  }
}

// Comment: viewQuiz function implementation is now imported from quiz-functions.js

// Comment: editQuiz function implementation is now imported from quiz-functions.js

// Comment: deleteQuiz function implementation is now imported from quiz-functions.js

// Comment: publishQuiz function implementation is now imported from quiz-functions.js

// Function to directly fetch quizzes from the server by reading the JSON file
async function fetchQuizzesDirectlyFromServer() {
  try {
    console.log('Attempting to directly fetch quizzes from server');
    const token = getTokenFromStorage();
    if (!token) {
      throw new Error('No authentication token found');
    }
    
    // Try with a direct URL path to the quizzes API without pagination
    const response = await fetch('/interac/api/quiz/quizzes?limit=50', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
      if (!response.ok) {
      throw new Error(`API responded with status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Direct fetch response:', data);
    
    // Normalize the quizzes data
    const loadedQuizzes = data.quizzes || [];
    
    // Ensure each quiz has an ID and required properties
        return loadedQuizzes.map(quiz => {
          return {
            id: quiz.id || quiz._id,
            name: quiz.name || quiz.title || 'Untitled Quiz',
            title: quiz.title || quiz.name || 'Untitled Quiz',
            description: quiz.description || '',
            questions: quiz.questions || [],
            timePerQuestion: quiz.timePerQuestion || 30,
            status: quiz.status || 'draft',
            createdAt: quiz.createdAt || new Date().toISOString()
          };
        });
      } catch (error) {
        console.error('Error directly fetching quizzes:', error);
        throw error;
      }
    }

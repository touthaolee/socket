// client-side/admin/admin-main.js
import { getTokenFromStorage } from '../client-utils/client-helpers.js';
import { aiService } from './service/ai-service.js';
import { similarityService } from './service/ai-similarity-service.js';

// --- Admin Auth Logic ---
function showAdminLogin() {
  // Show login modal by adding active class
  const loginModal = document.getElementById('admin-login-container');
  loginModal.classList.add('active');
  loginModal.style.display = 'flex';
  
  // Hide admin container
  const adminContainer = document.querySelector('.admin-container');
  adminContainer.style.display = 'none';
  
  console.log('Admin login shown - no valid token found');
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
const token = localStorage.getItem('auth_token');
console.log('Auth token found:', !!token);

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
    const response = await fetch('/interac/api/quizzes?page=1', {
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
      console.log('Token verification failed - API returned error');
      localStorage.removeItem('auth_token'); // Clear invalid token
      showAdminLogin();
    }
  } catch (error) {
    console.error('Authentication error:', error);
    showAdminLogin();
  }
}

// Load quizzes - also serves as a token verification method
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
    quizzes = data.quizzes;
    totalPages = data.totalPages || 1;
    
    renderQuizzes();
    updatePagination();
  } catch (error) {
    console.error('Error loading quizzes:', error);
    // Show error message
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
}

// Setup navigation
function setupNavigation() {
  // ...existing code...
}

// ...rest of the file remains unchanged...
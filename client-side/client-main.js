// client-side/client-main.js
import { initAuthSystem } from './client-modules/auth-module.js';
import { initSocketModule } from './client-modules/socket-module.js';
import { initQuizModule } from './client-modules/quiz-module.js';
import { showToast } from './client-utils/ui-utils.js';
import ChatModule from './client-modules/chat-module.js';

// Global state
let socket = null;
let chatModule = null;

// Initialize application when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
  console.log('InterAc Quiz Application - Initializing...');

  try {
    // Initialize core modules
    await initAuthSystem();
    const quizModule = initQuizModule();
    setupMainUI();

    // Register global variables for backwards compatibility
    window.setupAuthUI = function(callbacks) {
      console.log('Legacy setupAuthUI called');
    };
    window.setupChatUI = function(callbacks) {
      console.log('Legacy setupChatUI called');
    };

    // --- Robust session persistence ---
    const token = localStorage.getItem('auth_token');
    const username = localStorage.getItem('username');
    console.log('[DEBUG] Session restore: token', token);
    console.log('[DEBUG] Session restore: username', username);
    if (token && username) {
      // Restore authenticated state and UI
      window.showAuthenticatedUI();
    } else {
      // Show login UI if not authenticated
      if (typeof window.showLoginUI === 'function') {
        window.showLoginUI();
      } else {
        // Fallback: show auth container, hide app container
        const authContainer = document.getElementById('auth-container');
        const appContainer = document.getElementById('app-container');
        if (authContainer) authContainer.style.display = '';
        if (appContainer) appContainer.style.display = 'none';
      }
    }

    console.log('Application initialized successfully');
    showToast('Application initialized', 'success');

  } catch (error) {
    console.error('Error initializing application:', error);
    showToast('Error initializing application', 'error');
  }
});

/**
 * Set up the main UI elements
 */
function setupMainUI() {
  // Mobile menu toggle
  const menuToggle = document.querySelector('.mobile-menu-toggle');
  const mobileMenu = document.querySelector('.mobile-menu');
  
  if (menuToggle && mobileMenu) {
    menuToggle.addEventListener('click', () => {
      mobileMenu.classList.toggle('active');
      menuToggle.classList.toggle('active');
    });
  }
  
  // Theme toggle
  const themeToggle = document.querySelector('.theme-toggle');
  if (themeToggle) {
    // Check for saved theme
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      themeToggle.classList.add('active');
    }
    
    // Toggle theme on click
    themeToggle.addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme');
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      
      document.documentElement.setAttribute('data-theme', newTheme);
      localStorage.setItem('theme', newTheme);
      
      themeToggle.classList.toggle('active');
      showToast(`${newTheme.charAt(0).toUpperCase() + newTheme.slice(1)} theme activated`);
    });
  }
  
  // System preferences
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (prefersDark && !localStorage.getItem('theme')) {
    document.documentElement.setAttribute('data-theme', 'dark');
    if (themeToggle) themeToggle.classList.add('active');
  }
}

// --- Socket.IO Connection Status UI ---
function updateSocketStatusUI(status) {
  // Update status text (footer)
  const statusText = document.getElementById('server-status-text');
  if (statusText) {
    statusText.textContent = status === 'connected' ? 'Online' : 'Offline';
    statusText.style.color = status === 'connected' ? 'var(--success)' : 'var(--danger)';
  }
  // Update all indicators robustly (header and footer)
  ['connection-indicator', 'footer-connection-indicator'].forEach(id => {
    const indicator = document.getElementById(id);
    if (indicator) {
      indicator.classList.toggle('online', status === 'connected');
      indicator.classList.toggle('offline', status !== 'connected');
      // Fallback color if CSS variables are not applied
      indicator.style.backgroundColor = status === 'connected' ? '#06d6a0' : '#ef476f';
    }
  });
  // Also update header text if present
  const headerText = document.getElementById('connection-text');
  if (headerText) {
    headerText.textContent = status === 'connected' ? 'Online' : 'Offline';
    headerText.style.color = status === 'connected' ? 'var(--success)' : 'var(--danger)';
  }
}

/**
* Set up socket event handlers for quiz events
* @param {Object} socketClient - Socket client interface
*/
function setupSocketEventHandlers(socketClient) {
// Quiz start event
socketClient.on('quiz:start', (data) => {
  console.log('Quiz started:', data);
  if (window.startQuiz && data.quizId) {
    window.startQuiz(data.quizId);
  }
});

// Quiz question event
socketClient.on('quiz:question', (data) => {
  console.log('Quiz question received:', data);
  if (window.displayQuestion && data) {
    window.displayQuestion(data);
  }
});

// Quiz end event
socketClient.on('quiz:end', (data) => {
  console.log('Quiz ended:', data);
  if (window.showResults && data) {
    window.showResults(data);
  }
});

// Chat messages
socketClient.on('chat_message', (data) => {
  console.log('Chat message received:', data);
  
  // Add to chat messages if function exists
  if (typeof window.addChatMessage === 'function') {
    window.addChatMessage(data);
  }
});

// User list updates
socketClient.on('user_list', (data) => {
  console.log('User list updated:', data);
  
  // Update user list if function exists
  if (typeof window.updateUserList === 'function') {
    window.updateUserList(data);
  }
});

// Connect/disconnect events
socketClient.on('connect', () => {
  console.log('Socket connected');
  showToast('Connected to server', 'success');
  updateSocketStatusUI('connected');
});

socketClient.on('disconnect', (reason) => {
  console.log('Socket disconnected:', reason);
  showToast('Disconnected from server', 'error');
  updateSocketStatusUI('disconnected');
});
}

// Add a global function to start socket after login
window.startSocketAfterLogin = function(authOptions) {
  const socketClient = initSocketModule(authOptions);
  setupSocketEventHandlers(socketClient);
  window.socketClient = socketClient; // Make globally accessible
  
  // Initialize chat module with the socket client
  if (!window.chatModule) {
    window.chatModule = new ChatModule(socketClient);
    window.chatModule.init();
    console.log('Chat module initialized');
  }
}

// Modern, robust, and comprehensive post-login UI handler
window.showAuthenticatedUI = function() {
  // Hide login/auth UI
  const authContainer = document.getElementById('auth-container');
  if (authContainer) authContainer.style.display = 'none';

  // Show main app UI
  const appContainer = document.getElementById('app-container');
  if (appContainer) appContainer.style.display = '';

  // Optionally update username display
  const username = localStorage.getItem('username');
  const usernameDisplay = document.getElementById('username-display');
  if (usernameDisplay && username) usernameDisplay.textContent = username;

  // Update userId display
  const userIdDisplay = document.getElementById('user-id-display');
  let userId = '';
  if (window.socketClient && window.socketClient.userId) {
    userId = window.socketClient.userId;
  } else {
    // Try to get from cookie or localStorage as fallback
    try {
      const stored = localStorage.getItem('userId');
      if (stored) userId = stored;
    } catch (e) {}
  }
  if (userIdDisplay) userIdDisplay.textContent = userId ? `ID: ${userId}` : '';

  // Start socket connection with correct auth (token or username)
  const token = localStorage.getItem('auth_token');
  window.startSocketAfterLogin({
    auth: token ? { token, username } : { username }
  });

  // Optionally, focus the first interactive element in the app
  const firstInput = appContainer && appContainer.querySelector('input, button, select, textarea, [tabindex]:not([tabindex="-1"])');
  if (firstInput) firstInput.focus();

  // Show a welcome toast
  if (typeof window.showToast === 'function') {
    window.showToast(`Welcome, ${username || 'User'}!`, 'success');
  }
};

// On load, set initial status to offline until socket connects
updateSocketStatusUI('disconnected');

// Initialize and integrate the new ChatModule when the app loads
window.ChatModule = ChatModule;
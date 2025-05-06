// client-side/admin/admin-main.js
import { getTokenFromStorage } from '../client-utils/client-helpers.js';
import { aiService } from './service/ai-service.js';
import { similarityService } from './service/ai-similarity-service.js';
import adminChatService from './service/admin-chat-service.js';

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
    
    // For simplicity, we'll use a fixed admin user ID
    // In a real application, you would decode the JWT to get user details
    const adminUsername = 'admin';
    const adminUserId = '1';
    
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
  
  // Channel selection
  const channelList = document.getElementById('chat-channel-list');
  if (channelList) {
    channelList.addEventListener('click', (e) => {
      const channelItem = e.target.closest('.channel-item');
      if (channelItem) {
        const channelName = channelItem.querySelector('.channel-name').textContent.substring(2); // Remove '# ' prefix
        
        // Update active channel in UI
        document.querySelectorAll('.channel-item').forEach(item => {
          item.classList.remove('active');
        });
        channelItem.classList.add('active');
        
        // Update current channel display
        document.getElementById('current-channel').textContent = `# ${channelName}`;
        
        // Switch channel in service
        adminChatService.switchChannel(channelName);
      }
    });
  }
  
  // Create new channel button
  const createChannelBtn = document.getElementById('create-channel-btn');
  if (createChannelBtn) {
    createChannelBtn.addEventListener('click', () => {
      const channelName = prompt('Enter new channel name:');
      if (channelName) {
        adminChatService.createChannel(channelName);
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
  adminChatService.on('messageReceived', ({ channelId, messages }) => {
    // Only update UI if this is the current channel
    if (channelId === adminChatService.currentChannel) {
      updateChatMessages(messages);
    }
  });
  
  // When channels are updated
  adminChatService.on('channelsUpdated', ({ channels }) => {
    updateChannelsList(channels);
  });
  
  // When channel is switched
  adminChatService.on('channelSwitched', ({ channelId, messages }) => {
    updateChatMessages(messages);
  });
}

// Update the users list in the UI
function updateUsersList(users, onlineCount) {
  const userList = document.getElementById('chat-user-list');
  const onlineCountElement = document.getElementById('online-count');
  
  if (userList) {
    userList.innerHTML = '';
    
    if (users.length === 0) {
      userList.innerHTML = `
        <div class="user-item">
          <span class="user-status offline"></span>
          <span class="user-name">No users online</span>
        </div>
      `;
    } else {
      users.forEach(user => {
        const userStatus = user.status || 'online';
        userList.innerHTML += `
          <div class="user-item" data-user-id="${user.userId}">
            <span class="user-status ${userStatus}"></span>
            <span class="user-name">${user.username}</span>
          </div>
        `;
      });
    }
  }
  
  if (onlineCountElement) {
    onlineCountElement.textContent = onlineCount || 0;
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
          No messages in this channel yet. Be the first to say hello!
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
      const firstInitial = message.username ? message.username.charAt(0).toUpperCase() : '?';
      
      chatMessages.innerHTML += `
        <div class="message" data-message-id="${message.id}">
          <div class="message-avatar">${firstInitial}</div>
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

// Update the channels list in the UI
function updateChannelsList(channels) {
  const channelList = document.getElementById('chat-channel-list');
  if (!channelList) return;
  
  channelList.innerHTML = '';
  
  channels.forEach(channel => {
    const isActive = channel.id === adminChatService.currentChannel;
    channelList.innerHTML += `
      <div class="channel-item ${isActive ? 'active' : ''}" data-channel-id="${channel.id}">
        <span class="channel-name"># ${channel.name}</span>
      </div>
    `;
  });
}
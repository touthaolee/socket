// client-side/client-main.js
import socketClient from './client-socket/socket-client.js';
import { setupAuthUI, setupChatUI } from './client-components/auth-components.js';
import { setupChatHandlers } from './client-components/chat-components.js';
import { setTokenInStorage, getTokenFromStorage, removeTokenFromStorage } from './client-utils/client-helpers.js';
import { initQuizComponents } from './client-components/quiz-question.js';
import { initResultsComponents } from './client-components/quiz-results.js';

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
  // Initialize Socket.io client
  const socket = socketClient.init();
  
  // Initialize UI components
  setupAuthUI({
    onLogin: handleLogin,
    onRegister: handleRegister
  });
  
  setupChatUI({
    onSendMessage: (message) => {
      socket.emit('chat_message', { message });
    }
  });
  
  // Initialize quiz components
  initQuizComponents();
  initResultsComponents();
  
  // Setup navigation
  setupNavigation();
  
  // Check if user is already logged in
  const token = getTokenFromStorage();
  if (token) {
    // Try to connect with stored token
    socketClient.connectWithToken(token);
  }
  
  // Setup socket event handlers
  setupSocketEventHandlers(socket);
  
  // Handle login form submission
  async function handleLogin(credentials) {
    try {
      const response = await fetch('/interac/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        return { success: false, error: data.error || 'Login failed' };
      }
      
      // Store token and connect
      setTokenInStorage(data.token);
      socketClient.connectWithToken(data.token);
      
      return { success: true, user: data.user };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Server error, please try again' };
    }
  }
  
  // Handle register form submission
  async function handleRegister(userData) {
    try {
      const response = await fetch('/interac/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        return { success: false, error: data.error || 'Registration failed' };
      }
      
      // Store token and connect
      setTokenInStorage(data.token);
      socketClient.connectWithToken(data.token);
      
      return { success: true, user: data.user };
    } catch (error) {
      console.error('Registration error:', error);
      return { success: false, error: 'Server error, please try again' };
    }
  }
  
  // Setup navigation
  function setupNavigation() {
    const menuItems = document.querySelectorAll('.menu-item');
    const views = document.querySelectorAll('.app-view');
    const navToggle = document.getElementById('nav-toggle');
    const navMenu = document.getElementById('nav-menu');
    
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
        
        // Close mobile menu if open
        navMenu.classList.remove('active');
      });
    });
    
    // Toggle mobile menu
    navToggle.addEventListener('click', () => {
      navMenu.classList.toggle('active');
    });
    
    // Logout button
    document.getElementById('logout-btn').addEventListener('click', () => {
      removeTokenFromStorage();
      document.getElementById('main-app').classList.add('hidden');
      document.getElementById('auth-container').classList.remove('hidden');
    });
  }
  
  // Setup socket event handlers
  function setupSocketEventHandlers(socket) {
    setupChatHandlers(socket);
    
    socket.on('connect', () => {
      console.log('Connected to server');
      document.getElementById('auth-container').classList.add('hidden');
      document.getElementById('main-app').classList.remove('hidden');
      
      // Setup user info
      setupUserInfo(socket.user);
      
      // Join as a user
      socket.emit('user_join');
    });
    
    socket.on('connect_error', (err) => {
      console.error('Connection error:', err.message);
      // If token is invalid, clear it
      if (err.message === 'Authentication error' || 
          err.message === 'Invalid authentication token') {
        removeTokenFromStorage();
      }
      document.getElementById('auth-container').classList.remove('hidden');
      document.getElementById('main-app').classList.add('hidden');
    });
  }
  
  // Setup user info
  function setupUserInfo(user) {
    if (!user) return;
    
    // Set username in profile
    document.getElementById('profile-username').textContent = user.username;
    
    // Set user info in chat
    document.getElementById('user-info').textContent = `Logged in as ${user.username}`;
  }
});
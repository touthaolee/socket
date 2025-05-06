// client-side/client-main.js
import socketClient from './client-socket/socket-client.js';
import { setupAuthUI, setupChatUI } from './client-components/auth-components.js';
import { setupChatHandlers } from './client-components/chat-components.js';
import { initQuizComponents } from './client-components/quiz-questions.js';
import { initResultsComponents } from './client-components/quiz-results.js';

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
  // Initialize Socket.io client
  const socket = socketClient.init();
  
  // Initialize UI components
  setupAuthUI({
    onLogin: handleLogin
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
  
  // Register updateUserList callback with socket client
  socketClient.registerUpdateUserListCallback(updateUserList);
  
  // Check if user is already logged in
  const username = localStorage.getItem('username');
  if (username) {
    // Try to connect with stored username
    socketClient.connectWithUsername(username);
  }
  
  // Setup socket event handlers
  setupSocketEventHandlers(socket);
  
  // Handle login form submission
  async function handleLogin(credentials) {
    try {
      const { username } = credentials;
      
      // Validate username
      if (!username || username.length < 2) {
        return { success: false, error: 'Username must be at least 2 characters' };
      }
      
      // Store username in local storage
      localStorage.setItem('username', username);
      
      // Connect to socket server with username
      const connected = socketClient.connectWithUsername(username);
      
      if (connected) {
        // Show main app container, hide auth container
        document.getElementById('auth-container').classList.add('hidden');
        document.getElementById('main-app').classList.remove('hidden');
        
        // Set username in profile
        document.getElementById('profile-username').textContent = username;
        document.getElementById('user-info').textContent = `Logged in as: ${username}`;
        
        return { success: true };
      } else {
        return { success: false, error: 'Could not connect to the server' };
      }
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'An unexpected error occurred' };
    }
  }
  
  // Update the user list in the UI when users change
  function updateUserList(users) {
    const userListElement = document.getElementById('user-list');
    
    // Clear existing user list
    userListElement.innerHTML = '';
    
    // If no users, show a message
    if (!users || users.length === 0) {
      const noUsersElement = document.createElement('div');
      noUsersElement.className = 'user-item';
      noUsersElement.textContent = 'No users online';
      userListElement.appendChild(noUsersElement);
      return;
    }
    
    // Add each user to the list
    users.forEach(user => {
      const userElement = document.createElement('div');
      userElement.className = 'user-item';
      
      const userStatus = document.createElement('span');
      userStatus.className = 'user-status online';
      
      const userName = document.createElement('span');
      userName.className = 'user-name';
      userName.textContent = user.username;
      
      userElement.appendChild(userStatus);
      userElement.appendChild(userName);
      userListElement.appendChild(userElement);
    });
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
      localStorage.removeItem('username');
      socket.disconnect();
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
      
      // Setup user info with username from local storage
      const username = localStorage.getItem('username');
      setupUserInfo({ username });
      
      // Join as a user
      socket.emit('user_join', username);
      
      // Share user information with admin panel
      socketClient.shareUserWithAdmins({
        userId: socket.id,
        username: username,
        status: 'online',
        isRegularUser: true
      });
    });
    
    socket.on('connect_error', (err) => {
      console.error('Connection error:', err.message);
      document.getElementById('auth-container').classList.remove('hidden');
      document.getElementById('main-app').classList.add('hidden');
    });
  }
  
  // Setup user info
  function setupUserInfo(user) {
    if (!user) return;
    
    // Set username in profile
    const profileUsername = document.getElementById('profile-username');
    if (profileUsername) {
      profileUsername.textContent = user.username;
    }
    
    // Set user info in chat
    const userInfo = document.getElementById('user-info');
    if (userInfo) {
      userInfo.textContent = `Logged in as ${user.username}`;
    }
  }
});
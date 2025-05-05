// client-side/client-main.js
import socketClient from './client-socket/socket-client.js';
import { setupAuthUI, setupChatUI } from './client-components/auth-components.js';
import { setupChatHandlers } from './client-components/chat-components.js';
import { setTokenInStorage, getTokenFromStorage, removeTokenFromStorage } from './client-utils/client-helpers.js';

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
  
  // Setup socket event handlers
  function setupSocketEventHandlers(socket) {
    setupChatHandlers(socket);
    
    socket.on('connect', () => {
      console.log('Connected to server');
      document.getElementById('auth-container').classList.add('hidden');
      document.getElementById('chat-container').classList.remove('hidden');
      
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
      document.getElementById('chat-container').classList.add('hidden');
    });
  }
});
// client-side/client-components/auth-components.js

/**
 * Setup authentication UI and event handlers
 * @param {Object} options - Configuration options
 * @param {Function} options.onLogin - Login form submission handler
 * @param {Function} options.onRegister - Register form submission handler
 */
export function setupAuthUI({ onLogin, onRegister }) {
    const tabBtns = document.querySelectorAll('.tab-btn');
    
    // Tab switching
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        // Remove active class from all tabs
        tabBtns.forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.auth-form').forEach(form => form.classList.remove('active'));
        
        // Add active class to clicked tab
        btn.classList.add('active');
        document.getElementById(`${btn.dataset.tab}-form`).classList.add('active');
      });
    });
    
    // Handle login form submission
    document.getElementById('login-btn').addEventListener('click', async () => {
      const username = document.getElementById('login-username').value;
      const password = document.getElementById('login-password').value;
      const errorElement = document.getElementById('login-error');
      
      // Validate input
      if (!username || !password) {
        errorElement.textContent = 'Username and password are required';
        return;
      }
      
      // Send login request
      const result = await onLogin({ username, password });
      
      if (!result.success) {
        errorElement.textContent = result.error;
      } else {
        // Display user info
        document.getElementById('user-info').textContent = `Logged in as: ${result.user.username}`;
      }
    });
    
    // Handle register form submission
    document.getElementById('register-btn').addEventListener('click', async () => {
      const username = document.getElementById('register-username').value;
      const email = document.getElementById('register-email').value;
      const password = document.getElementById('register-password').value;
      const confirmPassword = document.getElementById('register-confirm-password').value;
      const errorElement = document.getElementById('register-error');
      
      // Validate input
      if (!username || !email || !password) {
        errorElement.textContent = 'All fields are required';
        return;
      }
      
      if (password !== confirmPassword) {
        errorElement.textContent = 'Passwords do not match';
        return;
      }
      
      // Send register request
      const result = await onRegister({ username, email, password });
      
      if (!result.success) {
        errorElement.textContent = result.error;
      } else {
        // Display user info
        document.getElementById('user-info').textContent = `Logged in as: ${result.user.username}`;
      }
    });
  }
  
  /**
   * Setup chat UI components
   * @param {Object} options - Configuration options
   * @param {Function} options.onSendMessage - Message send handler
   */
  export function setupChatUI({ onSendMessage }) {
    // Chat message sending
    document.getElementById('send-btn').addEventListener('click', () => {
      const messageInput = document.getElementById('message-input');
      const message = messageInput.value.trim();
      
      if (message) {
        onSendMessage(message);
        messageInput.value = '';
      }
    });
    
    // Allow sending messages with Enter key
    document.getElementById('message-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const message = e.target.value.trim();
        if (message) {
          onSendMessage(message);
          e.target.value = '';
        }
      }
    });
  }
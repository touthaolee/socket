// client-side/client-components/auth-components.js

// Export auth-related UI setup functions
export function setupAuthUI(callbacks) {
  const { onLogin, onRegister } = callbacks;
  
  // Get form elements
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const loginBtn = document.getElementById('login-btn');
  const registerBtn = document.getElementById('register-btn');
  const loginError = document.getElementById('login-error');
  const registerError = document.getElementById('register-error');
  
  // Handle tab switching
  const tabBtns = document.querySelectorAll('.tab-btn');
  const authForms = document.querySelectorAll('.auth-form');
  
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabName = btn.dataset.tab;
      
      // Update active tab button
      tabBtns.forEach(tb => tb.classList.remove('active'));
      btn.classList.add('active');
      
      // Show correct form
      authForms.forEach(form => {
        if (form.id === `${tabName}-form`) {
          form.classList.add('active');
        } else {
          form.classList.remove('active');
        }
      });
    });
  });
  
  // Handle login form submission
  loginBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    
    // Get form values
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    
    // Basic validation
    if (!username || !password) {
      loginError.textContent = 'Please enter both username and password';
      return;
    }
    
    // Show loading state
    loginBtn.textContent = 'Logging in...';
    loginBtn.disabled = true;
    loginError.textContent = '';
    
    // Call the provided login callback
    const result = await onLogin({ username, password });
    
    // Reset button state
    loginBtn.textContent = 'Login';
    loginBtn.disabled = false;
    
    // Handle result
    if (!result.success) {
      loginError.textContent = result.error;
    }
  });
  
  // Handle register form submission
  registerBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    
    // Get form values
    const username = document.getElementById('register-username').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;
    const confirmPassword = document.getElementById('register-confirm-password').value;
    
    // Basic validation
    if (!username || !email || !password) {
      registerError.textContent = 'Please fill out all fields';
      return;
    }
    
    if (password !== confirmPassword) {
      registerError.textContent = 'Passwords do not match';
      return;
    }
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      registerError.textContent = 'Please enter a valid email address';
      return;
    }
    
    // Show loading state
    registerBtn.textContent = 'Creating account...';
    registerBtn.disabled = true;
    registerError.textContent = '';
    
    // Call the provided register callback
    const result = await onRegister({ username, email, password });
    
    // Reset button state
    registerBtn.textContent = 'Register';
    registerBtn.disabled = false;
    
    // Handle result
    if (!result.success) {
      registerError.textContent = result.error;
    }
  });
}

// Export chat UI setup function
export function setupChatUI(callbacks) {
  const { onSendMessage } = callbacks;
  
  const messageInput = document.getElementById('message-input');
  const sendBtn = document.getElementById('send-btn');
  
  // Send message on button click
  sendBtn.addEventListener('click', () => {
    sendMessage();
  });
  
  // Send message on Enter key
  messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  });
  
  // Send message function
  function sendMessage() {
    const message = messageInput.value.trim();
    
    if (message) {
      onSendMessage(message);
      messageInput.value = '';
    }
  }
}
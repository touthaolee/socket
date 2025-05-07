// client-side/client-components/auth-components.js

// Export auth-related UI setup functions
export function setupAuthUI(callbacks) {
  const { onLogin } = callbacks;
  
  // Get form elements
  const loginForm = document.getElementById('login-form');
  const loginBtn = document.getElementById('login-btn');
  const loginError = document.getElementById('login-error');
  const usernameInput = document.getElementById('login-username');
  
  // Add debounced username availability checker
  let usernameCheckTimeout;
  usernameInput.addEventListener('input', function() {
    const username = this.value.trim();
    
    // Clear previous timeout
    if (usernameCheckTimeout) {
      clearTimeout(usernameCheckTimeout);
    }
    
    // Clear previous error/success indicators
    loginError.textContent = '';
    usernameInput.classList.remove('error', 'success');
    
    // Don't check if username is empty
    if (!username || username.length < 2) {
      return;
    }
    
    // Set new timeout for checking (500ms delay to avoid too many requests)
    usernameCheckTimeout = setTimeout(async () => {
      try {
        // Check username availability
        const response = await fetch(`/interac/api/auth/check-username/${encodeURIComponent(username)}`);
        const data = await response.json();
        
        if (data.available) {
          // Username is available
          usernameInput.classList.add('success');
          usernameInput.classList.remove('error');
        } else {
          // Username is already in use
          usernameInput.classList.add('error');
          usernameInput.classList.remove('success');
          loginError.textContent = 'This username is already in use. Please choose a different one.';
        }
      } catch (error) {
        console.error('Error checking username availability:', error);
      }
    }, 500);
  });
  
  // Handle login form submission
  loginBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    
    // Get username value
    const username = usernameInput.value.trim();
    
    // Basic validation
    if (!username) {
      loginError.textContent = 'Please enter a username';
      return;
    }
    
    // Check if username is already flagged as in use
    if (usernameInput.classList.contains('error')) {
      loginError.textContent = 'This username is already in use. Please choose a different one.';
      return;
    }
    
    // Show loading state
    loginBtn.textContent = 'Entering...';
    loginBtn.disabled = true;
    loginError.textContent = '';
    
    // Call the provided login callback with only username
    const result = await onLogin({ username });
    
    // Reset button state
    loginBtn.textContent = 'Enter Platform';
    loginBtn.disabled = false;
    
    // Handle result
    if (!result.success) {
      loginError.textContent = result.error || 'Failed to login. Please try again.';
    }
  });
}

// Export chat UI setup function
export function setupChatUI(callbacks) {
  const { onSendMessage } = callbacks;
  
  const messageInput = document.getElementById('message-input');
  const sendBtn = document.getElementById('send-btn');
  
  // Filter for profanity in chat messages
  messageInput.addEventListener('input', function(e) {
    const profaneWords = ['fuck', 'shit', 'ass', 'bitch', 'dick', 'pussy', 'cunt'];
    const message = e.target.value.toLowerCase();
    
    let containsProfanity = profaneWords.some(word => {
      // Check for whole words to avoid false positives
      const regex = new RegExp(`\\b${word}\\b`, 'i');
      return regex.test(message);
    });
    
    if (containsProfanity) {
      messageInput.classList.add('error');
      sendBtn.disabled = true;
      sendBtn.title = 'Message contains inappropriate language';
    } else {
      messageInput.classList.remove('error');
      sendBtn.disabled = false;
      sendBtn.title = '';
    }
  });
  
  // Send message on button click
  sendBtn.addEventListener('click', () => {
    sendMessage();
  });
  
  // Send message on Enter key
  messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !sendBtn.disabled) {
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
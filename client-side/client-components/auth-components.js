// client-side/client-components/auth-components.js

// Export auth-related UI setup functions
export function setupAuthUI(callbacks) {
  const { onLogin } = callbacks;
  
  // Get form elements
  const loginForm = document.getElementById('login-form');
  const loginBtn = document.getElementById('login-btn');
  const loginError = document.getElementById('login-error');
  
  // Handle login form submission
  loginBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    
    // Get username value
    const username = document.getElementById('login-username').value.trim();
    
    // Basic validation
    if (!username) {
      loginError.textContent = 'Please enter a username';
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
      loginError.textContent = result.error;
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
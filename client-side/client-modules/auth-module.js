import { showToast } from '../client-utils/ui-utils.js';
import { setTokenInStorage, removeTokenFromStorage } from '../client-utils/storage-utils.js';
import { getState, setState } from '../../client-utils/state-manager.js';

// Initialize the authentication system
export async function initAuthSystem() {
  // Set up login form
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
  }
  
  // Set up logout button
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }
  
  console.log('Auth system initialized');
}

// Handle login form submission
async function handleLogin(e) {
  e.preventDefault();

  const loginBtn = document.getElementById('login-btn');
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');
  const errorElem = document.getElementById('login-error');

  // Clear any previous errors
  if (errorElem) errorElem.textContent = '';
  
  // Get input values
  const username = usernameInput?.value?.trim();
  const password = passwordInput?.value || '';
  
  if (!username) {
    if (errorElem) errorElem.textContent = 'Please enter a username';
    return;
  }
  
  // Show loading state
  if (loginBtn) {
    loginBtn.disabled = true;
    const originalText = loginBtn.innerHTML;
    loginBtn.innerHTML = '<span class="spinner"></span> Logging in...';
  }
  
  try {
    // Always POST to /login with username (and password if provided)
    const response = await fetch('/interac/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await response.json();
    if (response.ok && data.token) {
      localStorage.setItem('auth_token', data.token);
      localStorage.setItem('username', username);
      setState('user', data.user || { username });
      setState('isAuthenticated', true);
      showToast(`Welcome, ${username}!`, 'success');
      // Immediately start socket connection after login (like websocket-test.html)
      if (typeof window.startSocketAfterLogin === 'function') {
        window.startSocketAfterLogin({ auth: { token: data.token, username } });
      }
      window.showAuthenticatedUI();
      return;
    } else if (data.error) {
      if (errorElem) errorElem.textContent = data.error;
      showToast(data.error, 'error');
      return;
    }
    // Fallback for legacy/guest mode
    localStorage.setItem('username', username);
    setState('user', { username });
    setState('isAuthenticated', true);
    showToast(`Welcome, ${username}!`, 'success');
    window.showAuthenticatedUI();
  } catch (error) {
    console.error('Login error:', error);
    if (errorElem) errorElem.textContent = error.message || 'Login failed. Please try again.';
  } finally {
    // Restore button state
    if (loginBtn) {
      loginBtn.disabled = false;
      loginBtn.innerHTML = 'Begin Quiz Experience <span class="btn-icon"><i class="fas fa-arrow-right"></i></span>';
    }
  }
}

// Authenticate with server using username/password
async function authenticateWithCredentials(username, password) {
  try {
    const response = await fetch('/interac/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username, password })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Authentication failed');
    }
    
    if (data.token) {
      // Save auth token
      setTokenInStorage(data.token);
      
      // Save user data to app state
      setState('user', data.user || { username });
      setState('isAuthenticated', true);
      
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Authentication error:', error);
    throw error;
  }
}

// Handle logout
function handleLogout() {
  // Remove authentication token
  removeTokenFromStorage();
  localStorage.removeItem('username');

  // Update app state
  setState('isAuthenticated', false);
  setState('user', null);

  // Disconnect socket
  const socket = getState('socket');
  if (socket && socket.connected) {
    socket.disconnect();
  }

  // Show login UI (robust fallback)
  if (typeof window.showLoginUI === 'function') {
    window.showLoginUI();
  } else {
    // Fallback: show auth container, hide app container
    const authContainer = document.getElementById('auth-container');
    const appContainer = document.getElementById('app-container');
    if (authContainer) authContainer.style.display = '';
    if (appContainer) appContainer.style.display = 'none';
  }

  showToast('You have been logged out', 'info');
}

/**
 * Get the current authentication token (JWT) from storage, with robust error handling.
 * @returns {string|null} The JWT token if available, or null.
 */
export function getAuthToken() {
  try {
    const token = localStorage.getItem('auth_token');
    if (typeof token === 'string' && token.length > 0) {
      return token;
    }
    return null;
  } catch (err) {
    // Optionally, show a toast or log the error
    if (typeof window.showToast === 'function') {
      window.showToast('Could not access authentication token. Please check your browser settings.', 'error');
    }
    console.error('getAuthToken error:', err);
    return null;
  }
}

// Export functions for use in other modules
export { handleLogin, handleLogout, authenticateWithCredentials };
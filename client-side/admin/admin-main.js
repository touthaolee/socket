// client-side/admin/admin-main.js
import { getTokenFromStorage } from '../client-utils/client-helpers.js';
import { aiService } from './service/ai-service.js';
import { similarityService } from './service/ai-similarity-service.js';

// --- Admin Auth Logic ---
function showAdminLogin() {
  document.getElementById('admin-login-container').style.display = 'block';
  document.querySelector('.admin-container').style.display = 'none';
  console.log('Admin login shown - no valid token found');
}

function showAdminDashboard() {
  document.getElementById('admin-login-container').style.display = 'none';
  document.querySelector('.admin-container').style.display = 'block';
  
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

// Verify token validity on page load - ONLY show dashboard if token exists
const token = localStorage.getItem('auth_token');
console.log('Auth token found:', !!token); // Debug log
if (!token) {
  showAdminLogin();
} else {
  // We'll verify the token with the server
  verifyTokenAndShowDashboard();
}

// New function to verify token validity with the server
async function verifyTokenAndShowDashboard() {
  try {
    // Try to make an authenticated API call to verify token
    const response = await fetch('/interac/api/auth/verify', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (response.ok) {
      showAdminDashboard();
      // Only initialize UI when token is verified
      initAdminUI();
      loadQuizzes();
    } else {
      // Token is invalid
      console.log('Token verification failed');
      localStorage.removeItem('auth_token'); // Clear invalid token
      showAdminLogin();
    }
  } catch (error) {
    console.error('Token verification error:', error);
    showAdminLogin();
  }
}

// NEVER initialize views without checking token first
// Remove the unconditional call to initViewsImmediately()

// Force visibility of dashboard ONLY if we have a valid token
document.addEventListener('DOMContentLoaded', function() {
  console.log('admin-main.js DOMContentLoaded fired');
  
  // Re-check token on DOM load
  const token = localStorage.getItem('auth_token');
  if (!token) {
    showAdminLogin();
    return;
  }
  
  // Check if dashboard is visible
  const adminContainer = document.querySelector('.admin-container');
  if (adminContainer) {
    const displayStyle = window.getComputedStyle(adminContainer).display;
    console.log('Admin container display style:', displayStyle);
    
    if (displayStyle === 'none' && token) {
      console.log('Forcing admin container to display');
      adminContainer.style.display = 'flex'; // Force display only if token exists
    }
  }
});

// Initialize views only when called explicitly after authentication
function initViewsImmediately() {
  const views = document.querySelectorAll('.admin-view');
  const menuItems = document.querySelectorAll('.menu-item');
  
  if (views.length > 0 && !document.querySelector('.admin-view.active')) {
    views[0].classList.add('active');
    if
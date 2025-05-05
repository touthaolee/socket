// client-side/client-utils/client-helpers.js

// Storage keys
const TOKEN_STORAGE_KEY = 'auth_token';

/**
 * Store JWT token in localStorage
 * @param {string} token - JWT token to store
 */
export function setTokenInStorage(token) {
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

/**
 * Get JWT token from localStorage
 * @returns {string|null} JWT token or null if not found
 */
export function getTokenFromStorage() {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

/**
 * Remove JWT token from localStorage
 */
export function removeTokenFromStorage() {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
}

/**
 * Format date object to localized string
 * @param {string|Date} dateStr - Date string or object
 * @returns {string} Formatted date string
 */
export function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleString();
}

/**
 * Escape HTML to prevent XSS attacks
 * @param {string} unsafe - Unsafe string that might contain HTML
 * @returns {string} Escaped string
 */
export function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Debounce function to limit rate of function calls
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}
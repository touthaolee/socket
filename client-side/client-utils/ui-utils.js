// client-side/client-utils/ui-utils.js

/**
 * Show a toast notification
 * @param {string} message - Message to display
 * @param {string} type - Type of toast (info, success, error, warning)
 * @param {number} duration - Duration in ms 
 * @returns {HTMLElement} Toast element
 */
export function showToast(message, type = 'info', duration = 5000) {
    // Create toast container if it doesn't exist
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    // Choose icon based on type
    let icon = 'info-circle';
    if (type === 'success') icon = 'check-circle';
    if (type === 'error') icon = 'exclamation-circle';
    if (type === 'warning') icon = 'exclamation-triangle';
    
    // Set toast content
    toast.innerHTML = `
      <div class="toast-icon">
        <i class="fas fa-${icon}"></i>
      </div>
      <div class="toast-content">${message}</div>
      <button class="toast-close">
        <i class="fas fa-times"></i>
      </button>
    `;
    
    // Add to container
    container.appendChild(toast);
    
    // Add remove on click
    toast.querySelector('.toast-close').addEventListener('click', () => {
      fadeOutToast(toast);
    });
    
    // Auto-remove after duration
    setTimeout(() => {
      fadeOutToast(toast);
    }, duration);
    
    // Return the toast element
    return toast;
  }
  
  /**
   * Fade out and remove a toast element
   * @param {HTMLElement} toast - Toast element to remove
   */
  function fadeOutToast(toast) {
    // Add fade-out class
    toast.classList.add('toast-fade-out');
    
    // Remove after animation completes
    setTimeout(() => {
      toast.remove();
    }, 300);
  }
  
  /**
   * Create a spinner element
   * @param {string} size - Size (sm, md, lg)
   * @param {string} color - Color
   * @returns {HTMLElement} Spinner element
   */
  export function createSpinner(size = 'md', color = null) {
    const spinner = document.createElement('div');
    spinner.className = `spinner spinner-${size}`;
    
    if (color) {
      spinner.style.borderTopColor = color;
    }
    
    return spinner;
  }
  
  /**
   * Show loading overlay
   * @param {HTMLElement} container - Container element
   * @param {string} message - Loading message
   * @returns {HTMLElement} Overlay element
   */
  export function showLoading(container, message = 'Loading...') {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'loading-overlay';
    
    // Add spinner and message
    overlay.innerHTML = `
      <div class="loading-content">
        <div class="spinner"></div>
        <p>${message}</p>
      </div>
    `;
    
    // Apply to container
    container.style.position = 'relative';
    container.appendChild(overlay);
    
    return overlay;
  }
  
  /**
   * Hide loading overlay
   * @param {HTMLElement} overlay - Overlay element
   */
  export function hideLoading(overlay) {
    if (!overlay) return;
    
    // Add fade-out class
    overlay.classList.add('fade-out');
    
    // Remove after animation
    setTimeout(() => {
      overlay.remove();
    }, 300);
  }
  
  /**
   * Format date to readable string
   * @param {Date|string} date - Date to format
   * @param {object} options - Format options
   * @returns {string} Formatted date
   */
  export function formatDate(date, options = {}) {
    if (!date) return '';
    
    const d = new Date(date);
    
    // Check if valid date
    if (isNaN(d.getTime())) return '';
    
    // Default options
    const defaultOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    };
    
    // Merge options
    const formatOptions = { ...defaultOptions, ...options };
    
    return d.toLocaleDateString(undefined, formatOptions);
  }
  
  /**
   * Format time to readable string
   * @param {Date|string} time - Time to format
   * @param {object} options - Format options
   * @returns {string} Formatted time
   */
  export function formatTime(time, options = {}) {
    if (!time) return '';
    
    const d = new Date(time);
    
    // Check if valid date
    if (isNaN(d.getTime())) return '';
    
    // Default options
    const defaultOptions = {
      hour: '2-digit',
      minute: '2-digit'
    };
    
    // Merge options
    const formatOptions = { ...defaultOptions, ...options };
    
    return d.toLocaleTimeString(undefined, formatOptions);
  }
  
  /**
   * Format seconds to mm:ss
   * @param {number} seconds - Seconds to format
   * @returns {string} Formatted time
   */
  export function formatSeconds(seconds) {
    if (isNaN(seconds)) return '00:00';
    
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  
  /**
   * Sanitize HTML string
   * @param {string} html - HTML to sanitize
   * @returns {string} Sanitized HTML
   */
  export function sanitizeHtml(html) {
    const element = document.createElement('div');
    element.textContent = html;
    return element.innerHTML;
  }
  
  /**
   * Create element with properties
   * @param {string} tag - Element tag
   * @param {object} props - Element properties
   * @param {Array} children - Child elements or text
   * @returns {HTMLElement} Created element
   */
  export function createElement(tag, props = {}, children = []) {
    // Create element
    const element = document.createElement(tag);
    
    // Add properties
    Object.entries(props).forEach(([key, value]) => {
      if (key === 'className') {
        element.className = value;
      } else if (key === 'style' && typeof value === 'object') {
        Object.assign(element.style, value);
      } else if (key.startsWith('on') && typeof value === 'function') {
        const eventName = key.slice(2).toLowerCase();
        element.addEventListener(eventName, value);
      } else {
        element.setAttribute(key, value);
      }
    });
    
    // Add children
    children.forEach(child => {
      if (typeof child === 'string') {
        element.appendChild(document.createTextNode(child));
      } else if (child instanceof Node) {
        element.appendChild(child);
      }
    });
    
    return element;
  }
  
  /**
   * Animate element with CSS animation
   * @param {HTMLElement} element - Element to animate
   * @param {string} animation - Animation name
   * @param {number} duration - Duration in ms
   * @returns {Promise} Promise that resolves when animation ends
   */
  export function animate(element, animation, duration = 1000) {
    return new Promise(resolve => {
      element.style.animation = `${animation} ${duration}ms`;
      
      const handleAnimationEnd = () => {
        element.style.animation = '';
        element.removeEventListener('animationend', handleAnimationEnd);
        resolve();
      };
      
      element.addEventListener('animationend', handleAnimationEnd);
    });
  }
  
  // Export additional utility functions
  export {
    fadeOutToast,
    formatDate,
    formatTime,
    formatSeconds,
    sanitizeHtml,
    createElement
  };
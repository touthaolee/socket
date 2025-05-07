// client-side/client-modules/chat-module.js

import { showToast } from '../client-utils/ui-utils.js';
import { getTokenFromStorage } from '../client-utils/storage-utils.js';

/**
 * Chat Module - Handles chat UI, message processing, and error correction
 */
class ChatModule {
  constructor(socket) {
    this.socket = socket;
    this.currentUsername = localStorage.getItem('username') || 'Guest';
    this.chatMessages = [];
    this.unreadCount = 0;
    this.isChatVisible = false;
    this.isFloating = false;
    this.isMinimized = false;
    this.typingUsers = new Set();
    this.typingTimeout = null;
    this.spellingCorrections = new Map();
    this.MAX_CHAT_HISTORY = 100;
    
    // Common typos and corrections for error handling
    this.commonCorrections = {
      'recieve': 'receive',
      'alot': 'a lot',
      'seperate': 'separate',
      'definately': 'definitely',
      'accomodate': 'accommodate',
      'occured': 'occurred',
      'tommorrow': 'tomorrow',
      'wierd': 'weird',
      'didnt': "didn't",
      'dont': "don't",
      'cant': "can't",
      'wont': "won't",
      'isnt': "isn't",
      'shouldnt': "shouldn't",
      'wouldnt': "wouldn't",
      'couldnt': "couldn't",
      'im': "I'm",
      'theres': "there's",
      'theyre': "they're",
      'thats': "that's",
      'hows': "how's",
      'whats': "what's",
      'whos': "who's",
      'wheres': "where's",
      'whens': "when's",
      'whys': "why's",
      'havent': "haven't",
      'hasnt': "hasn't",
      'hadnt': "hadn't",
      'wasnt': "wasn't",
      'werent': "weren't",
      'arent': "aren't",
      'youre': "you're",
      'youve': "you've",
      'youd': "you'd",
      'youll': "you'll",
      'ive': "I've",
      'id': "I'd",
      'ill': "I'll",
      'hes': "he's",
      'shes': "she's",
      'weve': "we've",
      'wed': "we'd",
      'well': "we'll",
      'theyve': "they've",
      'theyd': "they'd",
      'theyll': "they'll",
      'doesnt': "doesn't",
      'isnt': "isn't",
      'shouldve': "should've",
      'wouldve': "would've",
      'couldve': "could've",
      'mightve': "might've",
      'mustve': "must've"
    };
    
    this.initEventListeners();
  }
  
  /**
   * Initialize the chat UI elements and event listeners
   */
  init() {
    // Chat toggle button
    const chatToggleBtn = document.getElementById('chat-toggle-btn');
    const chatCloseBtn = document.getElementById('chat-close-btn');
    const chatMinimizeBtn = document.getElementById('chat-minimize-btn');
    const chatSection = document.getElementById('chat-section');
    const chatInput = document.getElementById('chat-input');
    const chatSendBtn = document.getElementById('chat-send-btn');
    
    if (chatToggleBtn) {
      chatToggleBtn.addEventListener('click', () => this.toggleChat());
    }
    
    if (chatCloseBtn) {
      chatCloseBtn.addEventListener('click', () => this.hideChat());
    }
    
    if (chatMinimizeBtn) {
      chatMinimizeBtn.addEventListener('click', () => this.toggleMinimize());
    }
    
    if (chatInput) {
      chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.sendMessage();
        }
        
        // Send typing indicator
        this.sendTypingStatus();
      });
    }
    
    if (chatSendBtn) {
      chatSendBtn.addEventListener('click', () => this.sendMessage());
    }
    
    // Enable drag for floating chat (if needed in the future)
    if (chatSection) {
      this.enableDragAndDrop(chatSection);
    }
    
    // Initialize socket event listeners
    this.setupSocketEvents();
    
    // Add welcome message
    this.addSystemMessage('Welcome to the Interact Quiz chat! Ask questions or chat with other participants.');
  }
  
  /**
   * Set up all socket event listeners for chat functionality
   */
  setupSocketEvents() {
    if (!this.socket) return;
    
    // Listen for chat messages
    this.socket.on('chat_message', (data) => {
      console.log('Chat message received:', data);
      
      // Don't add duplicate messages from self (already added optimistically)
      if (!data.system && data.from === this.currentUsername) {
        return;
      }
      
      this.addMessage(data);
      
      // Increment unread count if chat is not visible
      if (!this.isChatVisible || this.isMinimized) {
        this.unreadCount++;
        this.updateUnreadBadge();
        
        // Show toast notification
        if (!data.system) {
          showToast(`${data.from}: ${data.message.substring(0, 30)}${data.message.length > 30 ? '...' : ''}`, 'info');
        }
      }
    });
    
    // Handle typing indicators
    this.socket.on('user_typing', (data) => {
      if (data.username !== this.currentUsername) {
        this.showTypingIndicator(data.username);
      }
    });
    
    // Handle when user stops typing
    this.socket.on('user_stop_typing', (data) => {
      if (data.username !== this.currentUsername) {
        this.hideTypingIndicator(data.username);
      }
    });
  }
  
  /**
   * Initialize event listeners for various UI elements
   */
  initEventListeners() {
    // Listen for login events to update username
    document.addEventListener('user:login', (e) => {
      this.currentUsername = e.detail.username || 'Guest';
    });
    
    // Listen for resize events to adjust chat position
    window.addEventListener('resize', () => {
      if (this.isFloating) {
        this.adjustFloatingChatPosition();
      }
    });
  }
  
  /**
   * Toggle the chat visibility
   */
  toggleChat() {
    const chatSection = document.getElementById('chat-section');
    const chatToggleBtn = document.getElementById('chat-toggle-btn');
    
    if (!chatSection) return;
    
    this.isChatVisible = !this.isChatVisible;
    
    if (this.isChatVisible) {
      chatSection.style.display = 'block';
      if (chatToggleBtn) {
        chatToggleBtn.innerHTML = '<i class="fas fa-comments"></i> <span>Hide Chat</span>';
      }
      
      // Reset unread count
      this.unreadCount = 0;
      this.updateUnreadBadge();
      
      // Focus the input
      setTimeout(() => {
        const chatInput = document.getElementById('chat-input');
        if (chatInput) chatInput.focus();
      }, 100);
    } else {
      chatSection.style.display = 'none';
      if (chatToggleBtn) {
        chatToggleBtn.innerHTML = '<i class="fas fa-comments"></i> <span>Show Chat</span>';
      }
    }
  }
  
  /**
   * Hide the chat panel
   */
  hideChat() {
    const chatSection = document.getElementById('chat-section');
    const chatToggleBtn = document.getElementById('chat-toggle-btn');
    
    if (!chatSection) return;
    
    chatSection.style.display = 'none';
    this.isChatVisible = false;
    
    if (chatToggleBtn) {
      chatToggleBtn.innerHTML = '<i class="fas fa-comments"></i> <span>Show Chat</span>';
    }
  }
  
  /**
   * Toggle between normal and minimized chat view
   */
  toggleMinimize() {
    const chatSection = document.getElementById('chat-section');
    const chatMinimizeBtn = document.getElementById('chat-minimize-btn');
    
    if (!chatSection) return;
    
    this.isMinimized = !this.isMinimized;
    
    if (this.isMinimized) {
      chatSection.classList.add('chat-minimized');
      if (chatMinimizeBtn) {
        chatMinimizeBtn.innerHTML = '<i class="fas fa-expand"></i>';
        chatMinimizeBtn.title = 'Expand';
      }
    } else {
      chatSection.classList.remove('chat-minimized');
      if (chatMinimizeBtn) {
        chatMinimizeBtn.innerHTML = '<i class="fas fa-minus"></i>';
        chatMinimizeBtn.title = 'Minimize';
      }
      
      // Reset unread count
      this.unreadCount = 0;
      this.updateUnreadBadge();
    }
  }
  
  /**
   * Toggle between floating and embedded chat modes
   */
  toggleFloatingMode() {
    const chatSection = document.getElementById('chat-section');
    
    if (!chatSection) return;
    
    this.isFloating = !this.isFloating;
    
    if (this.isFloating) {
      chatSection.classList.add('chat-floating');
      this.adjustFloatingChatPosition();
    } else {
      chatSection.classList.remove('chat-floating');
    }
  }
  
  /**
   * Adjust the position of the floating chat window
   */
  adjustFloatingChatPosition() {
    // Implement repositioning logic if needed
  }
  
  /**
   * Enable drag and drop functionality for the chat window
   * @param {HTMLElement} element - The draggable element
   */
  enableDragAndDrop(element) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    
    const chatHeader = element.querySelector('.chat-header');
    if (chatHeader) {
      chatHeader.style.cursor = 'move';
      chatHeader.onmousedown = dragMouseDown;
    }
    
    function dragMouseDown(e) {
      e = e || window.event;
      e.preventDefault();
      
      // Get the initial mouse cursor position
      pos3 = e.clientX;
      pos4 = e.clientY;
      
      document.onmouseup = closeDragElement;
      document.onmousemove = elementDrag;
    }
    
    function elementDrag(e) {
      e = e || window.event;
      e.preventDefault();
      
      // Calculate the new cursor position
      pos1 = pos3 - e.clientX;
      pos2 = pos4 - e.clientY;
      pos3 = e.clientX;
      pos4 = e.clientY;
      
      // Set the element's new position
      element.style.top = (element.offsetTop - pos2) + "px";
      element.style.left = (element.offsetLeft - pos1) + "px";
      element.style.bottom = 'auto';
      element.style.right = 'auto';
    }
    
    function closeDragElement() {
      // Stop moving when mouse button is released
      document.onmouseup = null;
      document.onmousemove = null;
    }
  }
  
  /**
   * Send a chat message
   */
  sendMessage() {
    const chatInput = document.getElementById('chat-input');
    
    if (!chatInput || !this.socket) return;
    
    const message = chatInput.value.trim();
    
    if (!message) return;
    
    // Apply spelling corrections
    const { correctedMessage, corrections } = this.correctSpelling(message);
    
    // Send message to server with username
    this.socket.emit('chat_message', {
      from: this.currentUsername,
      message: correctedMessage,
      timestamp: new Date().toISOString()
    });
    
    // Add to local display with self flag (optimistic UI)
    this.addMessage({
      from: this.currentUsername,
      message: correctedMessage,
      corrections,
      timestamp: new Date().toISOString(),
      isSelf: true
    });
    
    // Clear input
    chatInput.value = '';
    chatInput.focus();
    
    // Cancel any typing indicators
    this.cancelTypingIndicator();
  }
  
  /**
   * Apply spelling corrections to a message
   * @param {string} message - The message to check for spelling errors
   * @returns {Object} The corrected message and any corrections made
   */
  correctSpelling(message) {
    let correctedMessage = message;
    const corrections = {};
    
    // Split message into words
    const words = message.split(/\s+/);
    
    // Check each word against common corrections
    for (let i = 0; i < words.length; i++) {
      const word = words[i].toLowerCase().replace(/[.,?!;:'"()]/g, '');
      
      if (this.commonCorrections[word]) {
        // Save the original word and its correction
        corrections[words[i]] = this.commonCorrections[word];
        
        // Replace the word in the corrected message
        // Preserve original capitalization and punctuation
        const punctuation = words[i].match(/[.,?!;:'"()]/g) || [];
        const preserveCase = words[i][0] === words[i][0].toUpperCase();
        
        let correction = this.commonCorrections[word];
        if (preserveCase) {
          correction = correction.charAt(0).toUpperCase() + correction.slice(1);
        }
        
        correctedMessage = correctedMessage.replace(
          new RegExp(`\\b${words[i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g'), 
          correction + punctuation.join('')
        );
      }
    }
    
    return { correctedMessage, corrections };
  }
  
  /**
   * Add a message to the chat display
   * @param {Object} message - The message to display
   */
  addMessage(message) {
    const chatMessagesEl = document.getElementById('chat-messages');
    if (!chatMessagesEl) return;
    
    // Remove welcome message if present
    const welcomeMessage = chatMessagesEl.querySelector('.welcome-message');
    if (welcomeMessage) {
      welcomeMessage.remove();
    }
    
    // Create message element
    const messageEl = document.createElement('div');
    messageEl.className = 'chat-message';
    
    // Determine message type
    if (message.system) {
      messageEl.classList.add('chat-message-system');
      messageEl.textContent = message.message;
    } else {
      // Handle user message
      messageEl.classList.add(message.isSelf ? 'chat-message-self' : 'chat-message-other');
      
      // Create message header with username and time
      const messageHeader = document.createElement('div');
      messageHeader.className = 'chat-message-header';
      
      const messageName = document.createElement('div');
      messageName.className = 'chat-message-name';
      messageName.textContent = message.from || 'Anonymous';
      
      const messageTime = document.createElement('div');
      messageTime.className = 'chat-message-time';
      messageTime.textContent = this.formatTime(message.timestamp);
      
      messageHeader.appendChild(messageName);
      messageHeader.appendChild(messageTime);
      
      // Create message content
      const messageContent = document.createElement('div');
      messageContent.className = 'chat-message-content';
      
      // If there are corrections, highlight them
      if (message.corrections && Object.keys(message.corrections).length > 0) {
        let content = message.message;
        
        // Add correction highlights
        for (const [original, corrected] of Object.entries(message.corrections)) {
          const regex = new RegExp(`\\b${corrected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
          content = content.replace(regex, `<span class="correction">${corrected}</span>`);
          
          // Add tooltip
          const tooltip = document.createElement('div');
          tooltip.className = 'correction-tooltip';
          tooltip.textContent = `Corrected from: "${original}"`;
          messageContent.appendChild(tooltip);
        }
        
        messageContent.innerHTML = content;
      } else {
        messageContent.textContent = message.message;
      }
      
      messageEl.appendChild(messageHeader);
      messageEl.appendChild(messageContent);
    }
    
    // Add to DOM
    chatMessagesEl.appendChild(messageEl);
    
    // Scroll to bottom
    chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
    
    // Store in message history
    this.chatMessages.push(message);
    if (this.chatMessages.length > this.MAX_CHAT_HISTORY) {
      this.chatMessages.shift();
    }
  }
  
  /**
   * Add a system message to the chat
   * @param {string} message - The system message
   */
  addSystemMessage(message) {
    this.addMessage({
      system: true,
      message,
      timestamp: new Date().toISOString()
    });
  }
  
  /**
   * Format a timestamp for display
   * @param {string} timestamp - ISO timestamp string
   * @returns {string} Formatted time
   */
  formatTime(timestamp) {
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '—';
    }
  }
  
  /**
   * Send typing indicator to other users
   */
  sendTypingStatus() {
    if (!this.socket) return;
    
    // Clear previous timeout
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
    }
    
    // Emit typing event
    this.socket.emit('user_typing', { username: this.currentUsername });
    
    // Set timeout to emit stop typing after 3 seconds
    this.typingTimeout = setTimeout(() => {
      this.socket.emit('user_stop_typing', { username: this.currentUsername });
      this.typingTimeout = null;
    }, 3000);
  }
  
  /**
   * Cancel typing indicator
   */
  cancelTypingIndicator() {
    if (!this.socket) return;
    
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
      this.typingTimeout = null;
    }
    
    this.socket.emit('user_stop_typing', { username: this.currentUsername });
  }
  
  /**
   * Show typing indicator for a user
   * @param {string} username - Username of typing user
   */
  showTypingIndicator(username) {
    const chatMessagesEl = document.getElementById('chat-messages');
    if (!chatMessagesEl) return;
    
    // Add username to typing users set
    this.typingUsers.add(username);
    
    // Update typing indicator
    this.updateTypingIndicator();
  }
  
  /**
   * Hide typing indicator for a user
   * @param {string} username - Username to remove from typing
   */
  hideTypingIndicator(username) {
    // Remove username from typing users set
    this.typingUsers.delete(username);
    
    // Update typing indicator
    this.updateTypingIndicator();
  }
  
  /**
   * Update the typing indicator based on who is typing
   */
  updateTypingIndicator() {
    const chatMessagesEl = document.getElementById('chat-messages');
    if (!chatMessagesEl) return;
    
    // Remove any existing typing indicators
    const existingIndicator = chatMessagesEl.querySelector('.typing-indicator');
    if (existingIndicator) {
      existingIndicator.remove();
    }
    
    // If nobody is typing, return
    if (this.typingUsers.size === 0) return;
    
    // Create typing indicator
    const typingEl = document.createElement('div');
    typingEl.className = 'typing-indicator';
    
    // Add text based on who is typing
    if (this.typingUsers.size === 1) {
      typingEl.textContent = `${Array.from(this.typingUsers)[0]} is typing`;
    } else if (this.typingUsers.size === 2) {
      typingEl.textContent = `${Array.from(this.typingUsers).join(' and ')} are typing`;
    } else {
      typingEl.textContent = 'Several people are typing';
    }
    
    // Add animated dots
    for (let i = 0; i < 3; i++) {
      const dot = document.createElement('span');
      dot.className = 'typing-dot';
      typingEl.appendChild(dot);
    }
    
    // Add to DOM
    chatMessagesEl.appendChild(typingEl);
    
    // Scroll to bottom
    chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
  }
  
  /**
   * Update the unread message badge
   */
  updateUnreadBadge() {
    const chatToggleBtn = document.getElementById('chat-toggle-btn');
    
    if (!chatToggleBtn) return;
    
    // Remove existing badge
    const existingBadge = chatToggleBtn.querySelector('.unread-messages');
    if (existingBadge) {
      existingBadge.remove();
    }
    
    // Add new badge if there are unread messages
    if (this.unreadCount > 0) {
      const badge = document.createElement('span');
      badge.className = 'unread-messages';
      badge.textContent = this.unreadCount > 9 ? '9+' : this.unreadCount;
      
      chatToggleBtn.style.position = 'relative';
      chatToggleBtn.appendChild(badge);
    }
  }
}

export default ChatModule;
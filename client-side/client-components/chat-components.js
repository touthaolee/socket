// client-side/client-components/chat-components.js

/**
 * Setup handlers for chat-related socket events
 * @param {Object} socket - Socket.io client instance
 */
export function setupChatHandlers(socket) {
    const messagesContainer = document.getElementById('chat-messages');
    
    // Handle incoming chat messages
    socket.on('chat_message', (data) => {
      addMessageToChat(data);
    });
    
    // Handle user list updates
    socket.on('user_list', (users) => {
      updateUserList(users);
    });
    
    /**
     * Add a message to the chat display
     * @param {Object} data - Message data
     */
    function addMessageToChat(data) {
      const messageElement = document.createElement('div');
      messageElement.classList.add('message');
      messageElement.innerHTML = `
        <span class="user">${data.user}:</span>
        <span class="text">${data.message}</span>
        <span class="time">${new Date(data.timestamp).toLocaleTimeString()}</span>
      `;
      messagesContainer.appendChild(messageElement);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
    
    /**
     * Update the displayed user list
     * @param {Array} users - List of active users
     */
    function updateUserList(users) {
      const userListContainer = document.getElementById('user-list');
      if (userListContainer) {
        userListContainer.innerHTML = '';
        users.forEach(user => {
          const userElement = document.createElement('div');
          userElement.classList.add('user-item');
          userElement.textContent = user.username;
          userListContainer.appendChild(userElement);
        });
      }
    }
  }
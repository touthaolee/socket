// client-side/client-components/chat-components.js

// Setup chat handlers
export function setupChatHandlers(socket) {
    const chatMessages = document.getElementById('chat-messages');
    const userList = document.getElementById('user-list');
    
    // Get current username from localStorage
    const currentUsername = localStorage.getItem('username');
    
    // Handle incoming chat messages
    socket.on('chat_message', (data) => {
      addChatMessage(data);
    });
    
    // Handle user list updates
    socket.on('user_list', (users) => {
      updateUserList(users);
    });
    
    // Add a chat message
    function addChatMessage(data) {
      const messageElement = document.createElement('div');
      // Use localStorage username for comparison instead of socket.user
      messageElement.className = `message ${data.user === currentUsername ? 'message-mine' : 'message-other'}`;
      
      // Format time
      const time = new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      messageElement.innerHTML = `
        <div class="user">${data.user}</div>
        <div class="content">${data.message}</div>
        <div class="time">${time}</div>
      `;
      
      chatMessages.appendChild(messageElement);
      
      // Scroll to bottom
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    // Update the user list
    function updateUserList(users) {
      userList.innerHTML = '';
      
      if (!users || users.length === 0) {
        const emptyElement = document.createElement('div');
        emptyElement.className = 'empty-message';
        emptyElement.textContent = 'No users online';
        userList.appendChild(emptyElement);
        return;
      }
      
      users.forEach(user => {
        const userElement = document.createElement('div');
        userElement.className = 'user-item';
        
        // Handle both string usernames and user objects
        const username = typeof user === 'string' ? user : (user?.username || 'Anonymous');
        const isCurrentUser = username === currentUsername;
        
        if (isCurrentUser) {
          userElement.classList.add('current-user');
        }
        
        userElement.innerHTML = `
          <div class="user-status"></div>
          <div class="user-name">${username}${isCurrentUser ? ' (You)' : ''}</div>
        `;
        
        userList.appendChild(userElement);
      });
    }
  }
// client-side/client-components/chat-components.js

// Setup chat handlers
export function setupChatHandlers(socket) {
    const chatMessages = document.getElementById('chat-messages');
    const userList = document.getElementById('user-list');
    
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
      messageElement.className = `message ${data.user === socket.user.username ? 'message-mine' : 'message-other'}`;
      
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
      
      users.forEach(user => {
        const userElement = document.createElement('div');
        userElement.className = 'user-item';
        
        userElement.innerHTML = `
          <div class="user-status"></div>
          <div class="user-name">${user.username}</div>
        `;
        
        userList.appendChild(userElement);
      });
    }
  }
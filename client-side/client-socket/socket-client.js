// client-side/client-socket/socket-client.js
const socketClient = {
    socket: null,
    username: '',
    userId: '',
    
    // Initialize the socket client
    init() {
      this.socket = io({
        path: '/interac/socket.io',
        autoConnect: false // Don't connect automatically
      });
      
      // Setup default event handlers
      this.setupDefaultHandlers();
      
      return this.socket;
    },
    
    // Connect with JWT token
    connectWithToken(token) {
      if (!token) {
        console.error('Authentication token required');
        return false;
      }
      
      // Set auth data with token
      this.socket.auth = { token };
      
      // Connect to server
      this.socket.connect();
      return true;
    },
    
    // Connect with username only (simplified auth)
    connectWithUsername(username) {
      if (!username) {
        console.error('Username required');
        return false;
      }
      
      this.username = username;
      this.userId = `user_${Date.now()}`;
      
      // Set auth data with username
      this.socket.auth = { username };
      
      // Connect to server
      this.socket.connect();
      
      // Once connected, share this user with admin panel
      this.socket.on('connect', () => {
        this.shareUserWithAdmins({
          userId: this.socket.id,
          username: username,
          status: 'online',
          isRegularUser: true
        });
      });
      
      return true;
    },
    
    // Setup default event handlers
    setupDefaultHandlers() {
      if (!this.socket) return;
      
      // When server sends updated user list
      this.socket.on('users_online', (users) => {
        if (typeof window.updateUserList === 'function') {
          window.updateUserList(users);
        }
        // Store the updated user list
        this.activeUsers = users;
      });
    },
    
    // Get the socket instance
    getSocket() {
      if (!this.socket) {
        this.init();
      }
      return this.socket;
    },
    
    // Disconnect from server
    disconnect() {
      if (this.socket) {
        this.socket.disconnect();
      }
    },
    
    // Share user information with admin chat
    shareUserWithAdmins(userData) {
      if (!this.socket) {
        console.error('Socket not initialized');
        return false;
      }
      
      this.socket.emit('user:share-with-admin', userData);
      return true;
    },
    
    // Get current active users
    getActiveUsers() {
      return this.activeUsers || [];
    }
  };
  
  export default socketClient;
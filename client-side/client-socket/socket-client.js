// client-side/client-socket/socket-client.js
import { 
  getUserIdentityFromCookie, 
  setUserIdentityCookie, 
  removeUserIdentityCookie 
} from '../client-utils/storage-utils.js';

const socketClient = {
    socket: null,
    username: '',
    userId: '',
    activeUsers: [],
    updateUserListCallback: null,
    
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
      
      // Check for stored identity in cookies
      const storedIdentity = getUserIdentityFromCookie();
      
      // If this username matches the stored identity, use the stored userId
      // This allows the user to reclaim their previous identity
      if (storedIdentity && storedIdentity.username === username) {
        this.userId = storedIdentity.userId;
        console.log('Reconnecting with stored identity:', this.userId);
      } else {
        // Generate new userId for new users
        this.userId = `user_${Date.now()}`;
        // Store the identity in a cookie for future use
        setUserIdentityCookie(username, this.userId);
      }
      
      // Set auth data with username and userId
      this.socket.auth = { 
        username,
        userId: this.userId,
        isPreviousUser: !!storedIdentity && storedIdentity.username === username
      };
      
      // Connect to server
      this.socket.connect();
      
      // Once connected, share this user with admin panel
      this.socket.on('connect', () => {
        this.shareUserWithAdmins({
          userId: this.userId,
          socketId: this.socket.id,
          username: username,
          status: 'online',
          isRegularUser: true,
          isPreviousUser: !!storedIdentity && storedIdentity.username === username
        });
      });
      
      return true;
    },
    
    // Setup default event handlers
    setupDefaultHandlers() {
      if (!this.socket) return;
      
      // When server sends updated user list
      this.socket.on('users_online', (users) => {
        // Store the updated user list
        this.activeUsers = users;
        
        // Use the callback if it's registered
        if (typeof this.updateUserListCallback === 'function') {
          this.updateUserListCallback(users);
        }
      });
    },
    
    // Register the update user list callback
    registerUpdateUserListCallback(callback) {
      if (typeof callback === 'function') {
        this.updateUserListCallback = callback;
      }
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
        // Emit a user_logout event before disconnecting to properly remove user from online list
        if (this.socket.connected) {
          // Send more comprehensive user logout data to ensure proper cleanup
          this.socket.emit('user_logout', { 
            username: this.username,
            userId: this.userId || this.socket.id,
            forceRemove: true  // Flag to force complete removal from activeUsers
          });
          console.log('User logout event emitted with force removal flag');
          
          // Remove the identity cookie on explicit logout
          removeUserIdentityCookie();
          
          // Make sure we wait a moment for the server to process before disconnecting
          setTimeout(() => {
            this.socket.disconnect();
          }, 200);
        } else {
          this.socket.disconnect();
        }
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
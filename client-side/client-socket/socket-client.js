// client-side/client-socket/socket-client.js
import { 
  getUserIdentityFromCookie, 
  setUserIdentityCookie, 
  removeUserIdentityCookie,
  clearClientCache,
  clearAllTabsData
} from '../client-utils/storage-utils.js';

// BroadcastChannel for cross-tab synchronization
let logoutChannel;
try {
  logoutChannel = new BroadcastChannel('app_logout_channel');
} catch (e) {
  console.warn('BroadcastChannel not supported in this browser:', e);
  logoutChannel = null;
}

// Singleton instance for socket
let socketInstance = null;

const socketClient = {
    socket: null,
    username: '',
    userId: '',
    activeUsers: [],
    updateUserListCallback: null,
    logoutPromise: null,
    isLoggingOut: false,
    heartbeatInterval: null,
    reconnectAttempts: 0,
    maxReconnectAttempts: 5,
    isInitialized: false,
    
    // Get or create the socket client instance (singleton pattern)
    getSocket() {
      if (!this.isInitialized) {
        this.init();
      }
      return this.socket;
    },
    
    // Initialize the socket client
    init() {
      // Prevent multiple initializations
      if (this.isInitialized && this.socket) {
        console.log('Socket already initialized, reusing existing socket');
        return this.socket;
      }
      
      console.log('Initializing new socket connection');
      
      // Properly clean up any existing socket before creating a new one
      if (this.socket) {
        this.cleanupSocket();
      }
      
      // Determine if we're in production (using wss://) or development
      const isProduction = window.location.protocol === 'https:';
      const host = isProduction ? window.location.host : (window.location.hostname + ':8080');
      
      // Create socket with improved connection settings
      this.socket = io({
        path: '/interac/socket.io',
        autoConnect: false, // Don't connect automatically
        reconnection: true,
        reconnectionAttempts: 10, // Increased reconnection attempts
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000, // Increased timeout for slower connections
        transports: ['websocket', 'polling'], // Try WebSocket first, fall back to polling
        forceNew: true // Force a new connection to avoid issues with stale connections
      });
      
      // Store global reference to prevent duplication
      socketInstance = this.socket;
      
      // Setup default event handlers
      this.setupDefaultHandlers();
      
      // Setup cross-tab synchronization for logout
      this.setupCrossTabSync();
      
      this.isInitialized = true;
      return this.socket;
    },
    
    // Clean up socket resources properly
    cleanupSocket() {
      if (!this.socket) return;
      
      // Remove all listeners to prevent memory leaks
      this.socket.removeAllListeners();
      
      // Disconnect if connected
      if (this.socket.connected) {
        this.socket.disconnect();
      }
      
      // Stop any ongoing heartbeat
      this.stopHeartbeat();
      
      // Clear the socket instance
      this.socket = null;
      socketInstance = null;
      
      // Reset initialization flag
      this.isInitialized = false;
    },
    
    // Setup cross-tab synchronization
    setupCrossTabSync() {
      // Listen for storage events for cross-tab communication
      window.addEventListener('storage', (event) => {
        if (event.key === 'app_logout_event' && event.newValue === 'true') {
          console.log('Logout detected in another tab, disconnecting this tab');
          this.performLocalLogout(false); // Don't broadcast again to avoid loops
        }
      });
      
      // Listen for broadcast channel events
      if (logoutChannel) {
        logoutChannel.onmessage = (event) => {
          if (event.data === 'logout') {
            console.log('Logout broadcast received from another tab');
            this.performLocalLogout(false); // Don't broadcast again to avoid loops
          }
        };
      }
    },
    
    // Connect with JWT token
    async connectWithToken(token) {
      if (!token) {
        console.error('Authentication token required');
        return false;
      }
      
      // Ensure we're not in the process of logging out
      if (this.isLoggingOut) {
        console.warn('Cannot connect while logout is in progress');
        return false;
      }

      // Clear any existing logout state
      this.isLoggingOut = false;
      this.logoutPromise = null;
      
      // Always ensure we have a socket instance
      this.getSocket();
      
      // Set auth data with token
      this.socket.auth = { token };
      
      // Connect to server
      this.socket.connect();
      
      // Start heartbeat once connected
      this.socket.once('connect', () => {
        this.startHeartbeat();
      });
      
      return true;
    },
    
    // Connect with username only (simplified auth)
    async connectWithUsername(username) {
      if (!username) {
        console.error('Username required');
        return false;
      }
      
      // Ensure we're not in the process of logging out
      if (this.isLoggingOut) {
        console.warn('Cannot connect while logout is in progress');
        return false;
      }
      
      // Wait for any pending logout to complete
      if (this.logoutPromise) {
        try {
          await this.logoutPromise;
        } catch (e) {
          console.error('Error waiting for logout to complete:', e);
        }
      }

      // Clear any existing logout state
      this.isLoggingOut = false;
      this.logoutPromise = null;
      
      // Always ensure we have a socket instance using getSocket()
      this.getSocket();
      
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
      
      // Start heartbeat once connected
      this.socket.once('connect', () => {
        this.startHeartbeat();
      });
      
      return true;
    },
    
    // Start heartbeat to maintain activity status
    startHeartbeat() {
      // Clear any existing interval
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
      }
      
      // Send heartbeat every 15 seconds
      this.heartbeatInterval = setInterval(() => {
        if (this.socket && this.socket.connected) {
          this.socket.emit('user:heartbeat');
        } else {
          // If socket is not connected, clear the interval
          this.stopHeartbeat();
        }
      }, 15000);
    },
    
    // Stop heartbeat
    stopHeartbeat() {
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = null;
      }
    },
    
    // Set callback to update user list in UI
    setUserListCallback(callback) {
      if (typeof callback === 'function') {
        this.updateUserListCallback = callback;
      }
    },
    
    // Setup default event handlers
    setupDefaultHandlers() {
      // Handle reconnection attempts
      this.socket.on('reconnect_attempt', (attempt) => {
        console.log(`Reconnection attempt ${attempt}/${this.maxReconnectAttempts}`);
        this.reconnectAttempts = attempt;
      });
      
      // Reset reconnect counter on successful connection
      this.socket.on('connect', () => {
        console.log('Socket connected:', this.socket.id);
        this.reconnectAttempts = 0;
      });
      
      // Handle disconnection
      this.socket.on('disconnect', (reason) => {
        console.log('Socket disconnected:', reason);
        this.stopHeartbeat();
        
        // If we're in the process of logging out, don't attempt to reconnect
        if (this.isLoggingOut) {
          this.socket.disconnect(); // Ensure disconnection
        }
      });
      
      // Handle connection errors
      this.socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
      });
      
      // Handle user list updates
      this.socket.on('user_list', (users) => {
        this.activeUsers = users;
        
        // Call the callback if it exists
        if (this.updateUserListCallback) {
          this.updateUserListCallback(users);
        }
      });
      
      // Handle logout acknowledgment from server
      this.socket.on('user_logout_ack', (data) => {
        console.log('Logout acknowledged by server:', data);
        
        // Complete the logout process locally
        if (data && data.success) {
          // Resolve the logout promise if it exists
          if (this.logoutPromise && this._resolveLogout) {
            this._resolveLogout(data);
          }
          
          setTimeout(() => {
            // Reset logout state AFTER server acknowledges
            this.isLoggingOut = false;
            this.logoutPromise = null;
            this._resolveLogout = null;
            this._rejectLogout = null;
          }, 1000);
        } else {
          // If logout failed on server, reject the promise
          if (this.logoutPromise && this._rejectLogout) {
            this._rejectLogout(new Error('Server failed to complete logout'));
          }
          
          // Reset logout state but with a slight delay
          setTimeout(() => {
            this.isLoggingOut = false;
            this.logoutPromise = null;
            this._resolveLogout = null;
            this._rejectLogout = null;
          }, 1000);
        }
      });
    },
    
    // Disconnects the socket and cleans up resources
    async disconnect() {
      this.stopHeartbeat();
      
      if (this.socket) {
        this.socket.disconnect();
      }
    },
    
    // Perform logout operation with server notification
    async logout() {
      // If already logging out, return the existing promise
      if (this.isLoggingOut && this.logoutPromise) {
        return this.logoutPromise;
      }
      
      // Set logout state
      this.isLoggingOut = true;
      
      // Create a new promise for the logout process
      this.logoutPromise = new Promise((resolve, reject) => {
        this._resolveLogout = resolve;
        this._rejectLogout = reject;
        
        // If socket is connected, notify server of logout
        if (this.socket && this.socket.connected) {
          console.log('Sending logout notification to server');
          
          // Notify server with complete identity information
          this.socket.emit('user_logout', {
            username: this.username,
            userId: this.userId,
            forceRemove: true // Request complete removal from server
          });
          
          // Set a timeout for server acknowledgment
          const logoutTimeout = setTimeout(() => {
            console.warn('Server did not acknowledge logout in time, forcing disconnect');
            
            // Force disconnect after timeout
            this.socket.disconnect();
            
            // Perform local logout cleanup
            this.performLocalLogout(true);
            
            // Resolve the promise to unblock the UI
            if (this._resolveLogout) {
              this._resolveLogout({ 
                success: true, 
                message: 'Forced logout due to server timeout' 
              });
            }
          }, 5000); // 5 second timeout
          
          // Cancel timeout if we get a response
          this.socket.once('user_logout_ack', () => {
            clearTimeout(logoutTimeout);
            
            // Perform local cleanup on acknowledgment
            this.performLocalLogout(true);
          });
        } else {
          // If not connected, just do local cleanup
          console.log('Socket not connected, performing local logout only');
          this.performLocalLogout(true);
          
          // Resolve immediately since there's no server to acknowledge
          if (this._resolveLogout) {
            this._resolveLogout({ 
              success: true, 
              message: 'Local logout completed (not connected to server)' 
            });
          }
        }
      });
      
      return this.logoutPromise;
    },
    
    // Perform local logout cleanup (cookies, storage, etc.)
    performLocalLogout(broadcast = true) {
      // Clear identity cookie
      removeUserIdentityCookie();
      
      // Clear client cache
      clearClientCache();
      
      // Clear cross-tab shared data
      clearAllTabsData();
      
      // Stop heartbeat
      this.stopHeartbeat();
      
      // Disconnect socket
      if (this.socket) {
        this.socket.disconnect();
      }
      
      // Reset client state
      this.username = '';
      this.userId = '';
      this.activeUsers = [];
      this.isInitialized = false;
      
      // Notify other tabs about logout if broadcasting is enabled
      if (broadcast) {
        // Use localStorage for cross-tab communication
        try {
          localStorage.setItem('app_logout_event', 'true');
          // This event might be caught by other tabs via the storage event listener
          
          // Use BroadcastChannel if available (more reliable)
          if (logoutChannel) {
            logoutChannel.postMessage('logout');
          }
        } catch (e) {
          console.warn('Failed to broadcast logout event:', e);
        }
      }
      
      console.log('Local logout cleanup completed');
    },
    
    // Send a chat message
    sendChatMessage(message, roomId = 'global') {
      if (!this.socket || !this.socket.connected) {
        console.error('Cannot send message: Socket not connected');
        return false;
      }
      
      if (!message) {
        console.error('Cannot send empty message');
        return false;
      }
      
      // Ensure we have a user identity
      if (!this.username) {
        console.error('Cannot send message: No user identity');
        return false;
      }
      
      // Prepare message data
      const messageData = {
        userId: this.userId,
        username: this.username,
        message,
        roomId,
        timestamp: new Date().toISOString()
      };
      
      // Send message to server
      this.socket.emit('chat_message', messageData);
      
      return true;
    },
    
    // Join a chat room
    joinRoom(roomId) {
      if (!this.socket || !this.socket.connected) {
        console.error('Cannot join room: Socket not connected');
        return false;
      }
      
      if (!roomId) {
        console.error('Room ID required');
        return false;
      }
      
      // Join the room
      this.socket.emit('join_room', { 
        roomId,
        username: this.username,
        userId: this.userId
      });
      
      return true;
    },
    
    // Leave a chat room
    leaveRoom(roomId) {
      if (!this.socket || !this.socket.connected) {
        console.error('Cannot leave room: Socket not connected');
        return false;
      }
      
      if (!roomId) {
        console.error('Room ID required');
        return false;
      }
      
      // Leave the room
      this.socket.emit('leave_room', { 
        roomId,
        username: this.username,
        userId: this.userId
      });
      
      return true;
    },
    
    // Update user presence status
    updatePresence(status) {
      if (!this.socket || !this.socket.connected) {
        console.error('Cannot update presence: Socket not connected');
        return false;
      }
      
      if (!status) {
        console.error('Status required');
        return false;
      }
      
      // Send presence update to server
      this.socket.emit('user:presence', { 
        status,
        username: this.username,
        userId: this.userId
      });
      
      return true;
    },
    
    // Handle error recovery and reconnection
    handleErrorRecovery() {
      // Reset reconnection attempts
      this.reconnectAttempts = 0;
      
      // If socket exists, properly clean up
      if (this.socket) {
        this.cleanupSocket();
      }
      
      // Reinitialize socket with a clean slate
      this.init();
      
      // Reconnect with existing identity
      if (this.username) {
        this.connectWithUsername(this.username);
      }
    }
};

export default socketClient;
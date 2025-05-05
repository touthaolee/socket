// client-side/client-socket/socket-client.js
const socketClient = {
    socket: null,
    
    // Initialize the socket client
    init() {
      this.socket = io({
        path: '/interac/socket.io',
        autoConnect: false // Don't connect automatically
      });
      
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
    
    // Disconnect from server
    disconnect() {
      if (this.socket) {
        this.socket.disconnect();
      }
    }
  };
  
  export default socketClient;
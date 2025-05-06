import { getAuthToken } from './auth-module.js';
import { showToast } from '../client-utils/ui-utils.js';
import { getTokenFromStorage } from '../client-utils/storage-utils.js';

// Modern, robust Socket.IO module initializer
export function initSocketModule(options = {}) {
  // Example: options could include URL, auth, event handlers, etc.
  const { url = '/interac/socket.io', auth, onConnect, onError, onDisconnect } = options;
  let socket;
  try {
    // Dynamically import socket.io-client if not globally available
    const io = window.io || (window.require && window.require('socket.io-client'));
    if (!io) throw new Error('Socket.IO client not found');
    socket = io({
      path: url,
      auth: auth || { token: getAuthToken() }
    });
    if (onConnect) socket.on('connect', onConnect);
    if (onError) socket.on('connect_error', onError);
    if (onDisconnect) socket.on('disconnect', onDisconnect);
    return socket;
  } catch (err) {
    showToast('Failed to initialize socket connection.', 'error');
    console.error('initSocketModule error:', err);
    return null;
  }
}
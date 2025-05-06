// client-side/client-utils/storage-utils.js

// Storage keys
const TOKEN_KEY = 'auth_token';
const USER_KEY = 'user_data';
const USERNAME_KEY = 'username';
const THEME_KEY = 'theme';
const SETTINGS_KEY = 'app_settings';

// Set auth token in storage
export function setTokenInStorage(token) {
  if (!token) return false;
  localStorage.setItem(TOKEN_KEY, token);
  return true;
}

// Get auth token from storage
export function getTokenFromStorage() {
  return localStorage.getItem(TOKEN_KEY);
}

// Remove auth token from storage
export function removeTokenFromStorage() {
  localStorage.removeItem(TOKEN_KEY);
}

// Set user data in storage
export function setUserInStorage(userData) {
  if (!userData) return false;
  
  try {
    const userJson = JSON.stringify(userData);
    localStorage.setItem(USER_KEY, userJson);
    
    // Also set username for compatibility with older code
    if (userData.username) {
      localStorage.setItem(USERNAME_KEY, userData.username);
    }
    
    return true;
  } catch (error) {
    console.error('Error saving user data to storage:', error);
    return false;
  }
}

// Get user data from storage
export function getUserFromStorage() {
  try {
    const userJson = localStorage.getItem(USER_KEY);
    if (!userJson) return null;
    
    return JSON.parse(userJson);
  } catch (error) {
    console.error('Error reading user data from storage:', error);
    return null;
  }
}

// Remove user data from storage
export function removeUserFromStorage() {
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(USERNAME_KEY);
}

// Set theme preference
export function setThemePreference(theme) {
  localStorage.setItem(THEME_KEY, theme);
}

// Get theme preference
export function getThemePreference() {
  return localStorage.getItem(THEME_KEY);
}

// Set application settings
export function setAppSettings(settings) {
  try {
    const settingsJson = JSON.stringify(settings);
    localStorage.setItem(SETTINGS_KEY, settingsJson);
    return true;
  } catch (error) {
    console.error('Error saving app settings to storage:', error);
    return false;
  }
}

// Get application settings
export function getAppSettings() {
  try {
    const settingsJson = localStorage.getItem(SETTINGS_KEY);
    if (!settingsJson) return {};
    
    return JSON.parse(settingsJson);
  } catch (error) {
    console.error('Error reading app settings from storage:', error);
    return {};
  }
}

// Export additional storage functions as needed
export {
  TOKEN_KEY,
  USER_KEY,
  USERNAME_KEY,
  THEME_KEY,
  SETTINGS_KEY
};
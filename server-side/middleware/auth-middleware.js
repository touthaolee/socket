// server-side/middleware/auth-middleware.js
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { authService } = require('../service-registry');
const { logger } = require('../../logger');

/**
 * Middleware to verify JWT tokens from the Authorization header
 * Enhanced with better error handling and security features
 */
const authMiddleware = async (req, res, next) => {
  try {
    // Get token from multiple sources (header, cookies, query)
    const token = extractTokenFromRequest(req);
    
    if (!token) {
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'No valid authentication token was provided' 
      });
    }
    
    // Verify token
    let decoded;
    try {
      decoded = authService.verifyToken(token);
    } catch (tokenError) {
      logger.warn(`Invalid token: ${tokenError.message}`);
      return res.status(401).json({ 
        error: 'Invalid authentication',
        message: tokenError.message === 'jwt expired' ? 
          'Your session has expired. Please log in again.' : 
          'Authentication failed. Please log in again.'
      });
    }
    
    if (!decoded) {
      return res.status(401).json({ 
        error: 'Invalid token',
        message: 'Authentication token is invalid' 
      });
    }
    
    // Check if token is blacklisted (for logged out users)
    const isBlacklisted = await authService.isTokenBlacklisted(token);
    if (isBlacklisted) {
      return res.status(401).json({ 
        error: 'Token revoked',
        message: 'This session has been revoked. Please log in again.' 
      });
    }
    
    // For admin users from environment variables, we don't need to check the database
    if (decoded.username === process.env.ADMIN_USERNAME && decoded.role === 'admin') {
      req.user = {
        id: decoded.id,
        username: decoded.username,
        role: 'admin',
        permissions: ['*'] // Admin has all permissions
      };
      
      // Add token to request for potential use by other middleware
      req.token = token;
      
      return next();
    }
    
    // For regular users, verify they still exist in the database
    try {
      const user = await authService.findUserById(decoded.id);
      
      if (!user) {
        return res.status(401).json({ 
          error: 'User not found',
          message: 'The user associated with this token no longer exists' 
        });
      }
      
      // Check if user is active/enabled
      if (user.disabled) {
        return res.status(403).json({ 
          error: 'Account disabled',
          message: 'Your account has been disabled. Please contact support.' 
        });
      }
      
      // Add user data to request for use in route handlers
      req.user = {
        id: user.id,
        username: user.username,
        role: user.role || 'user',
        email: user.email,
        permissions: user.permissions || []
      };
      
      // Add token to request for potential use by other middleware
      req.token = token;
      
      // Update last active timestamp
      authService.updateLastActive(user.id).catch(err => {
        logger.error(`Failed to update last active timestamp: ${err.message}`);
      });
      
      // Continue to the protected route
      next();
    } catch (userLookupError) {
      logger.error(`Error looking up user: ${userLookupError.message}`);
      return res.status(500).json({ 
        error: 'Authentication error',
        message: 'An error occurred during authentication' 
      });
    }
  } catch (error) {
    logger.error(`Authentication middleware error: ${error.message}`, error);
    res.status(500).json({ 
      error: 'Server error',
      message: 'An unexpected error occurred during authentication' 
    });
  }
};

/**
 * Middleware to check if user has admin role
 * Must be used after authMiddleware
 */
const adminMiddleware = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      error: 'Authentication required',
      message: 'You must be logged in to access this resource' 
    });
  }
  
  if (req.user.role !== 'admin') {
    logger.warn(`Unauthorized admin access attempt by user: ${req.user.username}`);
    return res.status(403).json({ 
      error: 'Access denied',
      message: 'You do not have permission to access this resource' 
    });
  }
  
  next();
};

/**
 * Middleware to check if user has specific permission
 * @param {string|string[]} requiredPermissions - Permission(s) required to access the route
 * @returns {function} Express middleware
 */
const requirePermission = (requiredPermissions) => {
  // Convert single permission to array
  const permissions = Array.isArray(requiredPermissions) ? 
    requiredPermissions : [requiredPermissions];
  
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'You must be logged in to access this resource' 
      });
    }
    
    // Admin role has all permissions
    if (req.user.role === 'admin') {
      return next();
    }
    
    // Check if user has any of the required permissions
    const userPermissions = req.user.permissions || [];
    const hasPermission = permissions.some(permission => 
      userPermissions.includes(permission) || userPermissions.includes('*')
    );
    
    if (!hasPermission) {
      logger.warn(`Permission denied for user ${req.user.username}: missing ${permissions.join(', ')}`);
      return res.status(403).json({ 
        error: 'Permission denied',
        message: 'You do not have the required permissions to access this resource' 
      });
    }
    
    next();
  };
};

/**
 * Rate limiting middleware for auth routes
 * Prevents brute force attacks
 */
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per window
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      error: 'Too many attempts',
      message: 'Too many login attempts. Please try again later.',
      retryAfter: Math.ceil(15 * 60 / 60) // Minutes until reset
    });
  }
});

/**
 * API rate limiting middleware
 * Prevents abuse of API endpoints
 */
const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`API rate limit exceeded for IP: ${req.ip}, User: ${req.user?.username || 'unauthenticated'}`);
    res.status(429).json({
      error: 'Rate limit exceeded',
      message: 'You have exceeded the rate limit. Please try again later.',
      retryAfter: Math.ceil(60 / 60) // Seconds until reset
    });
  },
  // Skip rate limiting for admin users
  skip: (req) => req.user && req.user.role === 'admin'
});

/**
 * Extract JWT token from request
 * Checks Authorization header, cookies, and query parameters
 * @param {Object} req - Express request object
 * @returns {string|null} JWT token or null if not found
 */
function extractTokenFromRequest(req) {
  // Check Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7); // Remove 'Bearer ' prefix
  }
  
  // Check cookies (if cookie-parser middleware is used)
  if (req.cookies && req.cookies.token) {
    return req.cookies.token;
  }
  
  // Check query parameters (less secure, but sometimes needed)
  if (req.query && req.query.token) {
    return req.query.token;
  }
  
  return null;
}

/**
 * Error handler middleware for authentication errors
 */
const authErrorHandler = (err, req, res, next) => {
  if (err.name === 'UnauthorizedError' || err.name === 'JsonWebTokenError') {
    logger.warn(`JWT validation error: ${err.message}`);
    return res.status(401).json({
      error: 'Authentication error',
      message: 'Invalid authentication token'
    });
  }
  
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'Token expired',
      message: 'Your session has expired. Please log in again.'
    });
  }
  
  next(err);
};

/**
 * CORS middleware with security configurations
 */
const corsMiddleware = (req, res, next) => {
  // Allow requests only from trusted origins
  const allowedOrigins = [
    'http://localhost:3000',
    'https://touthaolee.com',
    'https://www.touthaolee.com'
  ];
  
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  
  // Allow headers and methods
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  // Set security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  
  next();
};

/**
 * Security headers middleware
 * Adds recommended security headers to all responses
 */
const securityHeadersMiddleware = (req, res, next) => {
  // Set Content Security Policy
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' wss://touthaolee.com"
  );
  
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Enable XSS filter in browser
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Disable caching for sensitive routes
  if (req.path.includes('/api/auth/')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  
  next();
};

/**
 * Socket authentication middleware
 * Verifies authentication for socket connections
 */
const socketAuthMiddleware = (socket, next) => {
  try {
    const token = socket.handshake.auth.token || 
                  socket.handshake.headers.authorization?.replace('Bearer ', '') || 
                  socket.handshake.query.token;
    
    if (!token) {
      return next(new Error('Authentication required'));
    }
    
    const decoded = authService.verifyToken(token);
    if (!decoded) {
      return next(new Error('Invalid token'));
    }
    
    // Store user info in socket for use in handlers
    socket.user = {
      id: decoded.id,
      username: decoded.username,
      role: decoded.role || 'user'
    };
    
    // Update last active timestamp
    authService.updateLastActive(decoded.id).catch(err => {
      logger.error(`Socket auth: Failed to update last active: ${err.message}`);
    });
    
    next();
  } catch (error) {
    logger.error(`Socket authentication error: ${error.message}`);
    next(new Error('Authentication failed'));
  }
};

module.exports = {
  authMiddleware,
  adminMiddleware,
  requirePermission,
  authRateLimiter,
  apiRateLimiter,
  authErrorHandler,
  corsMiddleware,
  securityHeadersMiddleware,
  socketAuthMiddleware
};
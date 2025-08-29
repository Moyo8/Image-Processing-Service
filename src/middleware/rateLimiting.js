const rateLimit = require('express-rate-limit');

// General API rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict rate limiting for authentication endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 auth requests per windowMs
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
});

// Rate limiting for image uploads
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // Limit each IP to 50 uploads per hour
  message: {
    success: false,
    message: 'Upload limit exceeded. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting for image transformations
const transformLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100, // Limit each IP to 100 transformations per hour
  message: {
    success: false,
    message: 'Transformation limit exceeded. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Per-user rate limiting for expensive operations
const createUserLimiter = (maxRequests, windowMs, message) => {
  const userLimiters = new Map();
  
  return (req, res, next) => {
    if (!req.user) {
      return next();
    }
    
    const userId = req.user.id;
    
    if (!userLimiters.has(userId)) {
      userLimiters.set(userId, rateLimit({
        windowMs,
        max: maxRequests,
        message: {
          success: false,
          message
        },
        standardHeaders: false,
        legacyHeaders: false,
        keyGenerator: () => userId,
        skip: () => false
      }));
    }
    
    const limiter = userLimiters.get(userId);
    limiter(req, res, next);
  };
};

// User-specific transformation limiter
const userTransformLimiter = createUserLimiter(
  200, // 200 transformations per hour per user
  60 * 60 * 1000,
  'You have exceeded your transformation limit. Please try again later.'
);

// User-specific upload limiter
const userUploadLimiter = createUserLimiter(
  100, // 100 uploads per hour per user
  60 * 60 * 1000,
  'You have exceeded your upload limit. Please try again later.'
);

module.exports = {
  apiLimiter,
  authLimiter,
  uploadLimiter,
  transformLimiter,
  userTransformLimiter,
  userUploadLimiter
};

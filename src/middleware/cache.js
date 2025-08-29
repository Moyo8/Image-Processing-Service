const cache = require('../utils/cache');
const logger = require('../utils/logger');

/**
 * Cache middleware for GET requests
 * @param {number} ttl - Time to live in seconds
 * @param {function} keyGenerator - Function to generate cache key from request
 */
const cacheMiddleware = (ttl = 3600, keyGenerator = null) => {
  return async (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    try {
      // Generate cache key
      const cacheKey = keyGenerator 
        ? keyGenerator(req) 
        : `${req.originalUrl}-${req.user?.id || 'anonymous'}`;

      // Try to get from cache
      const cachedData = await cache.get(cacheKey);
      
      if (cachedData) {
        logger.info(`Cache hit for key: ${cacheKey}`);
        return res.status(200).json(cachedData);
      }

      // Store original json method
      const originalJson = res.json;

      // Override json method to cache the response
      res.json = function(data) {
        // Only cache successful responses
        if (res.statusCode === 200 && data.success !== false) {
          cache.set(cacheKey, data, ttl).catch(err => {
            logger.error('Cache set error:', err);
          });
          logger.info(`Cached response for key: ${cacheKey}`);
        }

        // Call original json method
        return originalJson.call(this, data);
      };

      next();
    } catch (error) {
      logger.error('Cache middleware error:', error);
      next(); // Continue without caching on error
    }
  };
};

/**
 * Cache invalidation middleware
 * @param {string|function} pattern - Cache key pattern or function to generate pattern
 */
const invalidateCache = (pattern) => {
  return async (req, res, next) => {
    try {
      const cachePattern = typeof pattern === 'function' 
        ? pattern(req) 
        : pattern;

      // Store original json method
      const originalJson = res.json;

      // Override json method to invalidate cache after successful response
      res.json = function(data) {
        // Only invalidate on successful operations
        if (res.statusCode < 400) {
          cache.keys(cachePattern).then(keys => {
            if (keys.length > 0) {
              Promise.all(keys.map(key => cache.del(key))).then(() => {
                logger.info(`Invalidated ${keys.length} cache entries matching: ${cachePattern}`);
              }).catch(err => {
                logger.error('Cache invalidation error:', err);
              });
            }
          }).catch(err => {
            logger.error('Cache keys lookup error:', err);
          });
        }

        // Call original json method
        return originalJson.call(this, data);
      };

      next();
    } catch (error) {
      logger.error('Cache invalidation middleware error:', error);
      next(); // Continue without invalidation on error
    }
  };
};

/**
 * Specific cache configurations
 */

// Cache user profile for 1 hour
const cacheUserProfile = cacheMiddleware(3600, (req) => `user-profile-${req.user.id}`);

// Cache user images list for 5 minutes
const cacheUserImages = cacheMiddleware(300, (req) => {
  const { page = 1, limit = 10, format, sortBy = 'createdAt', sortOrder = 'desc', tags } = req.query;
  return `user-images-${req.user.id}-${page}-${limit}-${format || 'all'}-${sortBy}-${sortOrder}-${tags || 'none'}`;
});

// Cache image details for 30 minutes
const cacheImageDetails = cacheMiddleware(1800, (req) => `image-details-${req.params.id}-${req.user.id}`);

// Cache analytics dashboard for 10 minutes
const cacheAnalytics = cacheMiddleware(600, (req) => `analytics-${req.user.id}-${req.path}`);

// Invalidate user-related caches
const invalidateUserCache = invalidateCache((req) => `*-${req.user.id}-*`);

// Invalidate image-specific caches
const invalidateImageCache = invalidateCache((req) => `*-${req.params.id}-*`);

module.exports = {
  cacheMiddleware,
  invalidateCache,
  cacheUserProfile,
  cacheUserImages,
  cacheImageDetails,
  cacheAnalytics,
  invalidateUserCache,
  invalidateImageCache
};

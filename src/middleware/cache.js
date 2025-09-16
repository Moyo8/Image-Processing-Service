// Caching disabled: middleware are no-ops so the rest of the app can import them
// without attempting to connect to Redis. This avoids Redis from killing the app while
// you work on a deployment/stability fix.

const noop = (req, res, next) => next();

const cacheMiddleware = (ttl = 3600 /* unused */, keyGenerator = null) => {
  return (req, res, next) => next();
};

const invalidateCache = (pattern) => {
  return (req, res, next) => next();
};

const cacheUserProfile = (req, res, next) => next();
const cacheUserImages = (req, res, next) => next();
const cacheImageDetails = (req, res, next) => next();
const cacheAnalytics = (req, res, next) => next();
const invalidateUserCache = (req, res, next) => next();
const invalidateImageCache = (req, res, next) => next();

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

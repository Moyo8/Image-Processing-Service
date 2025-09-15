const redis = require('redis');
const logger = require('./logger');
const { URL } = require('url');

class CacheService {
  constructor() {
    this.client = null;
    this.isConnected = false;
  }

  _sanitizeRedisUrl(raw) {
    if (!raw) return null;
    // Remove accidental surrounding angle brackets that users sometimes paste
    let s = raw.trim();
    if (s.startsWith('<') && s.endsWith('>')) {
      s = s.slice(1, -1);
    }
    // Some dashboards show the password wrapped in <...>, remove those too
    s = s.replace(/<([^>]+)>/g, '$1');
    return s;
  }

  async connect() {
    const rawUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    const redisUrl = this._sanitizeRedisUrl(rawUrl);

    try {
      // Parse to detect scheme (redis:// vs rediss://)
      let options = { url: redisUrl, socket: { connectTimeout: 10000 } };
      try {
        const parsed = new URL(redisUrl);
        if (parsed.protocol === 'rediss:') {
          // Enable TLS for secure Redis endpoints
          options.socket.tls = true;
          // Accept most certificates (use stricter checks in production)
          options.socket.rejectUnauthorized = false;
        }
      } catch (err) {
        logger.warn('Could not parse REDIS_URL, falling back to provided string');
      }

      this.client = redis.createClient(options);

      this.client.on('error', (err) => {
        logger.error('Redis Client Error:', err && err.message ? err.message : err);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        logger.info('Redis client connected');
        this.isConnected = true;
      });

      this.client.on('ready', () => {
        logger.info('Redis client ready');
      });

      await this.client.connect();
      return this.client;
    } catch (error) {
      logger.warn('Redis connection failed:', error && error.message ? error.message : error);
      this.isConnected = false;
      return null;
    }
  }

  async get(key) {
    if (!this.isConnected || !this.client) return null;
    try {
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error('Cache get error:', error);
      return null;
    }
  }

  async set(key, value, ttl = 3600) {
    if (!this.isConnected || !this.client) return false;
    try {
      await this.client.setEx(key, ttl, JSON.stringify(value));
      return true;
    } catch (error) {
      logger.error('Cache set error:', error);
      return false;
    }
  }

  async del(key) {
    if (!this.isConnected || !this.client) return false;
    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      logger.error('Cache delete error:', error);
      return false;
    }
  }

  async flush() {
    if (!this.isConnected || !this.client) return false;
    try {
      await this.client.flushAll();
      return true;
    } catch (error) {
      logger.error('Cache flush error:', error);
      return false;
    }
  }

  async exists(key) {
    if (!this.isConnected || !this.client) return false;
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      logger.error('Cache exists error:', error);
      return false;
    }
  }

  async keys(pattern) {
    if (!this.isConnected || !this.client) return [];
    try {
      return await this.client.keys(pattern);
    } catch (error) {
      logger.error('Cache keys error:', error);
      return [];
    }
  }

  async disconnect() {
    if (this.client) {
      try {
        await this.client.disconnect();
        this.isConnected = false;
        logger.info('Redis client disconnected');
      } catch (error) {
        logger.error('Redis disconnect error:', error);
      }
    }
  }
}

module.exports = new CacheService();

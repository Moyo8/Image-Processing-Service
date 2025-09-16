// Caching disabled: provide a no-op CacheService so importing modules don't cause
// Redis connections or crashes. This preserves the API but avoids network calls.

class CacheService {
  constructor() {
    this.client = null;
    this.isConnected = false;
  }

  async connect() {
    // No-op: do not connect to Redis when caching is disabled
    this.client = null;
    this.isConnected = false;
    return null;
  }

  async get(key) { return null; }
  async set(key, value, ttl = 3600) { return false; }
  async del(key) { return false; }
  async flush() { return false; }
  async exists(key) { return false; }
  async keys(pattern) { return []; }
  async disconnect() { this.client = null; this.isConnected = false; }
}

module.exports = new CacheService();

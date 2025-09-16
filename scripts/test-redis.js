// Simple Redis connectivity test for Redis Cloud
// Usage: set REDIS_URL in your environment, then run: node scripts/test-redis.js

const { createClient } = require('redis');

function sanitizeRedisUrl(raw) {
  if (!raw) return null;
  let s = raw.trim();
  if (s.startsWith('<') && s.endsWith('>')) s = s.slice(1, -1);
  s = s.replace(/<([^>]+)>/g, '$1');
  return s;
}

async function main() {
  const raw = process.env.REDIS_URL;
  const url = sanitizeRedisUrl(raw);
  if (!url) {
    console.error('No REDIS_URL found in environment. Set REDIS_URL and retry.');
    process.exit(2);
  }

  console.log('Using REDIS_URL:', url);

  const opts = { url };
  try {
    // detect rediss:// and enable TLS options
    const parsed = new URL(url);
    if (parsed.protocol === 'rediss:') {
      opts.socket = { tls: true, rejectUnauthorized: false };
    }
  } catch (e) {
    // ignore parse errors
  }

  const client = createClient(opts);

  client.on('error', (err) => console.error('Redis client error:', err && err.message ? err.message : err));

  try {
    console.log('Connecting...');
    await client.connect();
    console.log('Connected to Redis');

    const testKey = `test:connect:${Date.now()}`;
    await client.set(testKey, 'ok', { EX: 10 });
    const value = await client.get(testKey);

    if (value === 'ok') {
      console.log('Set/get successful — Redis connection OK');
      await client.del(testKey);
      await client.disconnect();
      process.exit(0);
    } else {
      console.error('Set/get failed — unexpected value:', value);
      await client.disconnect();
      process.exit(3);
    }
  } catch (err) {
    console.error('Redis test failed:', err && err.message ? err.message : err);
    try { await client.disconnect(); } catch (e) {}
    process.exit(1);
  }
}

main();

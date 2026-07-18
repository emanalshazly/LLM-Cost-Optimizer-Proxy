import { createClient } from 'redis';
import { logger } from '../utils/logger.js';
import { envFlag } from '../utils/env.js';

let redisClient = null;
let redisReady = false;

export function isCachingEnabled() {
  return envFlag('ENABLE_CACHING', true);
}

export function isRedisConnected() {
  return redisReady && redisClient !== null;
}

export function getRedisClient() {
  return redisClient;
}

/**
 * Redis is OPTIONAL.
 *
 * When ENABLE_CACHING=false, REDIS_URL is not set, or the server is
 * unreachable, the proxy keeps running and CacheService falls back to an
 * in-memory cache.
 *
 * @returns {Promise<boolean>} true when connected, false when running without Redis
 */
export async function connectRedis() {
  if (!isCachingEnabled()) {
    logger.info('🔴 Caching disabled (ENABLE_CACHING=false) — cache lookups are skipped');
    return false;
  }

  const url = process.env.REDIS_URL;
  if (!url) {
    logger.warn('🔴 REDIS_URL not set — using in-memory cache fallback');
    return false;
  }

  try {
    redisClient = createClient({
      url,
      socket: {
        connectTimeout: 5000,
        // Bound reconnect attempts so a dead Redis doesn't spam logs forever.
        reconnectStrategy: (retries) => (retries > 3 ? false : 500)
      }
    });

    redisClient.on('error', (err) => {
      redisReady = false;
      logger.error('Redis client error:', err.message);
    });
    redisClient.on('ready', () => { redisReady = true; });
    redisClient.on('end', () => { redisReady = false; });

    await redisClient.connect();
    redisReady = true;
    logger.info('🔴 Redis connected successfully');
    return true;
  } catch (error) {
    logger.error(`🔴 Redis connection failed (${error.message}) — using in-memory cache fallback`);
    redisClient = null;
    redisReady = false;
    return false;
  }
}

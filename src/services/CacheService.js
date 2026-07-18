import { createHash } from 'node:crypto';
import { getRedisClient, isRedisConnected, isCachingEnabled } from '../config/redis.js';
import { logger } from '../utils/logger.js';

const KEY_PREFIX = 'llm_cache:';
const MEMORY_CACHE_MAX_ENTRIES = 500;

/**
 * Cache service with graceful degradation:
 *  - Redis is used when connected.
 *  - Otherwise an in-memory Map with TTL and a size cap is used, so the proxy
 *    still caches with zero infrastructure.
 *
 * Cache keys are SHA-256 hashes of `prompt + model`, so raw prompts are never
 * stored in or recoverable from cache keys or logs.
 */
export class CacheService {
  /**
   * @param {object}  [options]
   * @param {object}  [options.client]  Redis-compatible client override (testing)
   * @param {boolean} [options.enabled] Override ENABLE_CACHING (testing)
   * @param {number}  [options.ttl]     TTL seconds override (testing)
   */
  constructor(options = {}) {
    this.injectedClient = options.client || null;
    this.enabled = options.enabled;
    this.ttl = options.ttl;
    this.memoryCache = new Map(); // key -> { value, expiresAt }
  }

  isEnabled() {
    return this.enabled !== undefined ? this.enabled : isCachingEnabled();
  }

  getTtl() {
    if (this.ttl !== undefined) return this.ttl;
    return parseInt(process.env.CACHE_TTL, 10) || 3600; // 1 hour default
  }

  activeClient() {
    if (this.injectedClient) return this.injectedClient;
    return isRedisConnected() ? getRedisClient() : null;
  }

  backend() {
    return this.activeClient() ? 'redis' : 'memory';
  }

  generateCacheKey(prompt, model) {
    const hash = createHash('sha256');
    hash.update(`${prompt}:${model}`);
    return `${KEY_PREFIX}${hash.digest('hex')}`;
  }

  async get(prompt, model) {
    if (!this.isEnabled()) return null;

    const key = this.generateCacheKey(prompt, model);

    try {
      const client = this.activeClient();
      if (client) {
        const cached = await client.get(key);
        if (cached) {
          logger.info(`Cache hit (${key.slice(0, 20)}…)`);
          return JSON.parse(cached);
        }
        return null;
      }

      const entry = this.memoryCache.get(key);
      if (!entry) return null;
      if (entry.expiresAt <= Date.now()) {
        this.memoryCache.delete(key);
        return null;
      }
      logger.info(`Cache hit (memory, ${key.slice(0, 20)}…)`);
      return JSON.parse(entry.value);
    } catch (error) {
      logger.error('Cache get error:', error.message);
      return null;
    }
  }

  /**
   * @param {string} prompt Raw prompt (only used to derive the hash key)
   * @param {string} model  Requested model the entry is cached under
   * @param {object} payload { response, modelUsed, tokensUsed, cost }
   */
  async set(prompt, model, payload) {
    if (!this.isEnabled()) return;

    const key = this.generateCacheKey(prompt, model);
    const value = JSON.stringify({ ...payload, timestamp: Date.now() });

    try {
      const client = this.activeClient();
      if (client) {
        await client.setEx(key, this.getTtl(), value);
        return;
      }

      this.evictMemoryCacheIfNeeded();
      this.memoryCache.set(key, {
        value,
        expiresAt: Date.now() + this.getTtl() * 1000
      });
    } catch (error) {
      logger.error('Cache set error:', error.message);
    }
  }

  evictMemoryCacheIfNeeded() {
    const now = Date.now();
    for (const [key, entry] of this.memoryCache) {
      if (entry.expiresAt <= now) this.memoryCache.delete(key);
    }
    while (this.memoryCache.size >= MEMORY_CACHE_MAX_ENTRIES) {
      // Map preserves insertion order: first key is the oldest.
      const oldestKey = this.memoryCache.keys().next().value;
      this.memoryCache.delete(oldestKey);
    }
  }

  async clear() {
    try {
      const client = this.activeClient();
      if (client) {
        const keys = await client.keys(`${KEY_PREFIX}*`);
        if (keys.length > 0) {
          await client.del(keys);
          logger.info(`Cleared ${keys.length} cache entries`);
        }
        return;
      }

      const size = this.memoryCache.size;
      this.memoryCache.clear();
      logger.info(`Cleared ${size} in-memory cache entries`);
    } catch (error) {
      logger.error('Cache clear error:', error.message);
    }
  }

  async getStats() {
    try {
      const client = this.activeClient();
      if (client) {
        const keys = await client.keys(`${KEY_PREFIX}*`);
        return {
          backend: 'redis',
          totalEntries: keys.length,
          ttlSeconds: this.getTtl()
        };
      }

      return {
        backend: 'memory',
        totalEntries: this.memoryCache.size,
        ttlSeconds: this.getTtl()
      };
    } catch (error) {
      logger.error('Cache stats error:', error.message);
      return { backend: this.backend(), totalEntries: 0, ttlSeconds: this.getTtl() };
    }
  }
}

import crypto from 'crypto';
import { getRedisClient } from '../config/redis.js';
import { logger } from '../utils/logger.js';

export class CacheService {
  constructor() {
    this.ttl = parseInt(process.env.CACHE_TTL) || 3600; // 1 hour default
  }

  generateCacheKey(prompt, model) {
    const hash = crypto.createHash('sha256');
    hash.update(`${prompt}:${model}`);
    return `llm_cache:${hash.digest('hex')}`;
  }

  async get(prompt, model) {
    if (process.env.ENABLE_CACHING !== 'true') {
      return null;
    }

    try {
      const redis = getRedisClient();
      const key = this.generateCacheKey(prompt, model);
      const cached = await redis.get(key);
      
      if (cached) {
        logger.info(`Cache hit for key: ${key}`);
        return JSON.parse(cached);
      }
      
      return null;
    } catch (error) {
      logger.error('Cache get error:', error);
      return null;
    }
  }

  async set(prompt, model, response, tokensUsed) {
    if (process.env.ENABLE_CACHING !== 'true') {
      return;
    }

    try {
      const redis = getRedisClient();
      const key = this.generateCacheKey(prompt, model);
      const value = JSON.stringify({
        response,
        tokensUsed,
        timestamp: Date.now()
      });
      
      await redis.setEx(key, this.ttl, value);
      logger.info(`Cached response for key: ${key}`);
    } catch (error) {
      logger.error('Cache set error:', error);
    }
  }

  async clear() {
    try {
      const redis = getRedisClient();
      const keys = await redis.keys('llm_cache:*');
      
      if (keys.length > 0) {
        await redis.del(keys);
        logger.info(`Cleared ${keys.length} cache entries`);
      }
    } catch (error) {
      logger.error('Cache clear error:', error);
    }
  }

  async getStats() {
    try {
      const redis = getRedisClient();
      const keys = await redis.keys('llm_cache:*');
      
      return {
        totalEntries: keys.length,
        memoryUsage: await redis.memory('usage')
      };
    } catch (error) {
      logger.error('Cache stats error:', error);
      return { totalEntries: 0, memoryUsage: 0 };
    }
  }
}
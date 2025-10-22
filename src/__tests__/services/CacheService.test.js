import { CacheService } from '../../services/CacheService.js';
import crypto from 'crypto';

// Mock Redis
jest.mock('../../config/redis.js', () => ({
  getRedisClient: jest.fn(() => ({
    get: jest.fn(),
    setEx: jest.fn(),
    del: jest.fn(),
    keys: jest.fn(),
    memory: jest.fn()
  }))
}));

// Mock logger
jest.mock('../../utils/logger.js', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
}));

describe('CacheService', () => {
  let cacheService;
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv, ENABLE_CACHING: 'true', CACHE_TTL: '3600' };
    cacheService = new CacheService();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('generateCacheKey', () => {
    it('should generate consistent cache keys', () => {
      const prompt = 'test prompt';
      const model = 'gpt-4';

      const key1 = cacheService.generateCacheKey(prompt, model);
      const key2 = cacheService.generateCacheKey(prompt, model);

      expect(key1).toBe(key2);
      expect(key1).toMatch(/^llm_cache:[a-f0-9]{64}$/);
    });

    it('should generate different keys for different inputs', () => {
      const key1 = cacheService.generateCacheKey('prompt1', 'gpt-4');
      const key2 = cacheService.generateCacheKey('prompt2', 'gpt-4');

      expect(key1).not.toBe(key2);
    });

    it('should generate different keys for different models', () => {
      const prompt = 'test prompt';
      const key1 = cacheService.generateCacheKey(prompt, 'gpt-4');
      const key2 = cacheService.generateCacheKey(prompt, 'gpt-3.5-turbo');

      expect(key1).not.toBe(key2);
    });
  });

  describe('get', () => {
    it('should return null when caching is disabled', async () => {
      process.env.ENABLE_CACHING = 'false';
      cacheService = new CacheService();

      const result = await cacheService.get('test', 'gpt-4');
      expect(result).toBeNull();
    });

    it('should return null when cache miss', async () => {
      const { getRedisClient } = await import('../../config/redis.js');
      const mockRedis = getRedisClient();
      mockRedis.get.mockResolvedValue(null);

      const result = await cacheService.get('test prompt', 'gpt-4');
      expect(result).toBeNull();
    });

    it('should return cached data on cache hit', async () => {
      const { getRedisClient } = await import('../../config/redis.js');
      const mockRedis = getRedisClient();
      const cachedData = {
        response: 'cached response',
        tokensUsed: { input: 10, output: 20, total: 30 },
        timestamp: Date.now()
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(cachedData));

      const result = await cacheService.get('test prompt', 'gpt-4');
      expect(result).toEqual(cachedData);
    });

    it('should return null on error', async () => {
      const { getRedisClient } = await import('../../config/redis.js');
      const mockRedis = getRedisClient();
      mockRedis.get.mockRejectedValue(new Error('Redis error'));

      const result = await cacheService.get('test prompt', 'gpt-4');
      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    it('should not cache when caching is disabled', async () => {
      process.env.ENABLE_CACHING = 'false';
      cacheService = new CacheService();
      const { getRedisClient } = await import('../../config/redis.js');
      const mockRedis = getRedisClient();

      await cacheService.set('test', 'gpt-4', 'response', { input: 10, output: 20, total: 30 });
      expect(mockRedis.setEx).not.toHaveBeenCalled();
    });

    it('should cache data with correct TTL', async () => {
      const { getRedisClient } = await import('../../config/redis.js');
      const mockRedis = getRedisClient();

      await cacheService.set('test prompt', 'gpt-4', 'test response', { input: 10, output: 20, total: 30 });

      expect(mockRedis.setEx).toHaveBeenCalled();
      const call = mockRedis.setEx.mock.calls[0];
      expect(call[1]).toBe(3600); // TTL

      const cachedData = JSON.parse(call[2]);
      expect(cachedData.response).toBe('test response');
      expect(cachedData.tokensUsed).toEqual({ input: 10, output: 20, total: 30 });
    });

    it('should handle cache set errors gracefully', async () => {
      const { getRedisClient } = await import('../../config/redis.js');
      const mockRedis = getRedisClient();
      mockRedis.setEx.mockRejectedValue(new Error('Redis error'));

      await expect(
        cacheService.set('test', 'gpt-4', 'response', {})
      ).resolves.not.toThrow();
    });
  });

  describe('clear', () => {
    it('should clear all cache entries', async () => {
      const { getRedisClient } = await import('../../config/redis.js');
      const mockRedis = getRedisClient();
      mockRedis.keys.mockResolvedValue(['key1', 'key2', 'key3']);

      await cacheService.clear();

      expect(mockRedis.keys).toHaveBeenCalledWith('llm_cache:*');
      expect(mockRedis.del).toHaveBeenCalledWith(['key1', 'key2', 'key3']);
    });

    it('should handle empty cache', async () => {
      const { getRedisClient } = await import('../../config/redis.js');
      const mockRedis = getRedisClient();
      mockRedis.keys.mockResolvedValue([]);

      await cacheService.clear();

      expect(mockRedis.del).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      const { getRedisClient } = await import('../../config/redis.js');
      const mockRedis = getRedisClient();
      mockRedis.keys.mockRejectedValue(new Error('Redis error'));

      await expect(cacheService.clear()).resolves.not.toThrow();
    });
  });

  describe('getStats', () => {
    it('should return cache statistics', async () => {
      const { getRedisClient } = await import('../../config/redis.js');
      const mockRedis = getRedisClient();
      mockRedis.keys.mockResolvedValue(['key1', 'key2']);
      mockRedis.memory.mockResolvedValue(1024);

      const stats = await cacheService.getStats();

      expect(stats.totalEntries).toBe(2);
      expect(stats.memoryUsage).toBe(1024);
    });

    it('should return zeros on error', async () => {
      const { getRedisClient } = await import('../../config/redis.js');
      const mockRedis = getRedisClient();
      mockRedis.keys.mockRejectedValue(new Error('Redis error'));

      const stats = await cacheService.getStats();

      expect(stats.totalEntries).toBe(0);
      expect(stats.memoryUsage).toBe(0);
    });
  });
});

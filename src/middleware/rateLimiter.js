import { RateLimiterRedis, RateLimiterMemory } from 'rate-limiter-flexible';
import { getRedisClient, isRedisConnected } from '../config/redis.js';
import { logger } from '../utils/logger.js';

function limiterOptions() {
  const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 60000;
  return {
    keyPrefix: 'rl_proxy',
    points: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
    duration: Math.max(1, Math.floor(windowMs / 1000))
  };
}

// Created lazily on first request so the limiter always reflects the actual
// infrastructure state (the previous version built a Redis limiter at import
// time, before connectRedis() ran, and crashed the server at boot).
let redisLimiter = null;
let memoryLimiter = null;

function getLimiter() {
  if (isRedisConnected()) {
    if (!redisLimiter) {
      redisLimiter = new RateLimiterRedis({
        storeClient: getRedisClient(),
        ...limiterOptions()
      });
    }
    return redisLimiter;
  }

  if (!memoryLimiter) {
    memoryLimiter = new RateLimiterMemory(limiterOptions());
  }
  return memoryLimiter;
}

export function rateLimitMiddleware() {
  return async (req, res, next) => {
    try {
      const limiter = getLimiter();
      await limiter.consume(req.ip);
      next();
    } catch (rejRes) {
      // rate-limiter-flexible rejects with an Error on store failures and
      // with a result object when the limit is actually exceeded.
      if (rejRes instanceof Error) {
        logger.error('Rate limiter store error, allowing request:', rejRes.message);
        return next();
      }

      const remainingPoints = rejRes.remainingPoints || 0;
      const msBeforeNext = rejRes.msBeforeNext || 1000;
      const limiter = getLimiter();

      logger.warn(`Rate limit exceeded for IP: ${req.ip}`);

      res.set({
        'Retry-After': Math.round(msBeforeNext / 1000) || 1,
        'X-RateLimit-Limit': limiter.points,
        'X-RateLimit-Remaining': remainingPoints,
        'X-RateLimit-Reset': new Date(Date.now() + msBeforeNext)
      });

      res.status(429).json({
        error: 'Too Many Requests',
        retryAfter: Math.round(msBeforeNext / 1000)
      });
    }
  };
}

export function setupRateLimiting(app) {
  app.use('/api/proxy', rateLimitMiddleware());
}

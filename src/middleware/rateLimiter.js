import { RateLimiterRedis } from 'rate-limiter-flexible';
import { getRedisClient } from '../config/redis.js';
import { logger } from '../utils/logger.js';

export function setupRateLimiting(app) {
  const rateLimiter = new RateLimiterRedis({
    storeClient: getRedisClient(),
    keyPrefix: 'rl_proxy',
    points: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    duration: parseInt(process.env.RATE_LIMIT_WINDOW_MS) / 1000 || 60,
  });

  const rateLimiterMiddleware = async (req, res, next) => {
    try {
      const key = req.ip;
      await rateLimiter.consume(key);
      next();
    } catch (rejRes) {
      const remainingPoints = rejRes.remainingPoints || 0;
      const msBeforeNext = rejRes.msBeforeNext || 1000;

      logger.warn(`Rate limit exceeded for IP: ${req.ip}`);

      res.set({
        'Retry-After': Math.round(msBeforeNext / 1000) || 1,
        'X-RateLimit-Limit': rateLimiter.points,
        'X-RateLimit-Remaining': remainingPoints,
        'X-RateLimit-Reset': new Date(Date.now() + msBeforeNext)
      });

      res.status(429).json({
        error: 'Too Many Requests',
        retryAfter: Math.round(msBeforeNext / 1000)
      });
    }
  };

  app.use('/api/proxy', rateLimiterMiddleware);
}
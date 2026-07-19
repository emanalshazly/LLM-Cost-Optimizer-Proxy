import express from 'express';
import { isMongoConnected, isRequestLoggingEnabled } from '../config/database.js';
import { isRedisConnected, isCachingEnabled } from '../config/redis.js';

const router = express.Router();

router.get('/', (req, res) => {
  const mongodb = (!isRequestLoggingEnabled() || !process.env.MONGODB_URI)
    ? 'disabled'
    : (isMongoConnected() ? 'connected' : 'disconnected');

  const redis = (!isCachingEnabled() || !process.env.REDIS_URL)
    ? 'disabled'
    : (isRedisConnected() ? 'connected' : 'disconnected');

  // Degraded means: a service that is configured and expected is down.
  // Optional services that are simply not configured report "disabled" and
  // do not affect the health status.
  const degraded = mongodb === 'disconnected' || redis === 'disconnected';

  res.status(degraded ? 503 : 200).json({
    status: degraded ? 'degraded' : 'ok',
    timestamp: new Date().toISOString(),
    services: {
      mongodb,
      redis
    }
  });
});

export default router;

import express from 'express';
import mongoose from 'mongoose';
import { getRedisClient } from '../config/redis.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {}
    };

    // Check MongoDB
    try {
      await mongoose.connection.db.admin().ping();
      health.services.mongodb = 'connected';
    } catch (error) {
      health.services.mongodb = 'disconnected';
      health.status = 'unhealthy';
    }

    // Check Redis
    try {
      const redis = getRedisClient();
      await redis.ping();
      health.services.redis = 'connected';
    } catch (error) {
      health.services.redis = 'disconnected';
      health.status = 'unhealthy';
    }

    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(health);

  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

export default router;
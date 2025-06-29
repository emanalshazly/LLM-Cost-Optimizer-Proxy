import { createClient } from 'redis';
import { logger } from '../utils/logger.js';

let redisClient;

export async function connectRedis() {
  try {
    redisClient = createClient({
      url: process.env.REDIS_URL
    });

    redisClient.on('error', (err) => {
      logger.error('Redis Client Error:', err);
    });

    await redisClient.connect();
    logger.info('🔴 Redis connected successfully');
  } catch (error) {
    logger.error('Redis connection error:', error);
    throw error;
  }
}

export function getRedisClient() {
  return redisClient;
}
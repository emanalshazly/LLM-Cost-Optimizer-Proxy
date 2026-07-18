import mongoose from 'mongoose';
import { logger } from '../utils/logger.js';
import { envFlag } from '../utils/env.js';

export function isRequestLoggingEnabled() {
  return envFlag('ENABLE_REQUEST_LOGGING', true);
}

export function isMongoConnected() {
  return mongoose.connection.readyState === 1;
}

/**
 * MongoDB is OPTIONAL.
 *
 * When MONGODB_URI is not set, request logging is disabled, or the database
 * is unreachable, the proxy keeps running and falls back to the in-memory
 * request store (see src/services/RequestStore.js).
 *
 * @returns {Promise<boolean>} true when connected, false when running without MongoDB
 */
export async function connectDB() {
  if (!isRequestLoggingEnabled()) {
    logger.info('📦 Request logging disabled (ENABLE_REQUEST_LOGGING=false) — using in-memory store');
    return false;
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    logger.warn('📦 MONGODB_URI not set — request logging will use the in-memory store');
    return false;
  }

  try {
    const conn = await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    logger.info(`📦 MongoDB connected: ${conn.connection.host}`);
    return true;
  } catch (error) {
    logger.error(`📦 MongoDB connection failed (${error.message}) — falling back to in-memory request store`);
    return false;
  }
}

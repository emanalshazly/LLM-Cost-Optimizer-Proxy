import mongoose from 'mongoose';
import { logger } from '../utils/logger.js';

export async function connectDB() {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    logger.info(`📦 MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    logger.error('MongoDB connection error:', error);
    throw error;
  }
}
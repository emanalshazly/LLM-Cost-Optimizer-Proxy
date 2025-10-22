import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { connectDB } from '../src/config/database.js';
import { connectRedis } from '../src/config/redis.js';
import { setupRateLimiting } from '../src/middleware/rateLimiter.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { logger } from '../src/utils/logger.js';
import proxyRoutes from '../src/routes/proxy.js';
import dashboardRoutes from '../src/routes/dashboard.js';
import healthRoutes from '../src/routes/health.js';

dotenv.config();

const app = express();

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));

// Rate limiting
setupRateLimiting(app);

// Routes
app.use('/api/proxy', proxyRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/health', healthRoutes);

// Root route
app.get('/', (req, res) => {
  res.json({
    message: 'LLM Cost Optimizer Proxy API',
    version: '1.0.0',
    endpoints: {
      proxy: '/api/proxy/chat',
      dashboard: '/api/dashboard/stats',
      health: '/api/health'
    }
  });
});

// Error handling
app.use(errorHandler);

// Initialize connections for serverless
let dbConnected = false;
let redisConnected = false;

async function initializeConnections() {
  if (!dbConnected) {
    try {
      await connectDB();
      dbConnected = true;
      logger.info('✅ MongoDB connected');
    } catch (error) {
      logger.error('MongoDB connection error:', error);
    }
  }

  if (!redisConnected) {
    try {
      await connectRedis();
      redisConnected = true;
      logger.info('✅ Redis connected');
    } catch (error) {
      logger.error('Redis connection error:', error);
    }
  }
}

// Vercel serverless function handler
export default async function handler(req, res) {
  // Initialize connections on cold start
  await initializeConnections();

  // Handle the request with Express
  return app(req, res);
}

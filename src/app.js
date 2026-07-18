import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { setupRateLimiting } from './middleware/rateLimiter.js';
import { errorHandler } from './middleware/errorHandler.js';
import { logger } from './utils/logger.js';
import proxyRoutes from './routes/proxy.js';
import dashboardRoutes from './routes/dashboard.js';
import healthRoutes from './routes/health.js';

/**
 * Builds the Express app without starting a listener or connecting to any
 * infrastructure, so tests can mount it directly with supertest.
 */
export function createApp() {
  const app = express();

  // Middleware
  app.use(helmet());
  app.use(compression());
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

  if (process.env.NODE_ENV !== 'test') {
    app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));
  }

  // Rate limiting (Redis-backed when available, in-memory otherwise)
  setupRateLimiting(app);

  // Routes
  app.use('/api/proxy', proxyRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/health', healthRoutes);

  // 404 + error handling
  app.use((req, res) => {
    res.status(404).json({ error: 'Not Found' });
  });
  app.use(errorHandler);

  return app;
}

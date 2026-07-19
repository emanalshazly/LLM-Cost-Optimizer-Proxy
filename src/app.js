import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { setupRateLimiting } from './middleware/rateLimiter.js';
import { requireApiKey } from './middleware/auth.js';
import { errorHandler } from './middleware/errorHandler.js';
import { logger } from './utils/logger.js';
import proxyRoutes from './routes/proxy.js';
import dashboardRoutes from './routes/dashboard.js';
import healthRoutes from './routes/health.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Builds the Express app without starting a listener or connecting to any
 * infrastructure, so tests can mount it directly with supertest.
 */
export function createApp() {
  const app = express();

  // Middleware
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        'script-src': ["'self'"]
      }
    }
  }));
  app.use(compression());
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

  if (process.env.NODE_ENV !== 'test') {
    app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));
  }

  // Web dashboard UI (static, unauthenticated — it calls the protected JSON API itself)
  app.use(express.static(path.join(__dirname, '..', 'public')));

  // Rate limiting (Redis-backed when available, in-memory otherwise)
  setupRateLimiting(app);

  // Routes (health stays public; proxy/dashboard require an API key when configured)
  app.use('/api/proxy', requireApiKey, proxyRoutes);
  app.use('/api/dashboard', requireApiKey, dashboardRoutes);
  app.use('/api/health', healthRoutes);

  // 404 + error handling
  app.use((req, res) => {
    res.status(404).json({ error: 'Not Found' });
  });
  app.use(errorHandler);

  return app;
}

// IMPORTANT: load .env before any other module reads process.env.
// ES module imports evaluate in order, so this import must stay first.
import './config/env.js';

import fs from 'node:fs';
import { createApp } from './app.js';
import { connectDB } from './config/database.js';
import { connectRedis } from './config/redis.js';
import { logger } from './utils/logger.js';

const PORT = process.env.PORT || 3001;

async function startServer() {
  try {
    fs.mkdirSync('logs', { recursive: true });

    // MongoDB and Redis are OPTIONAL. The proxy degrades gracefully to
    // in-memory caching and request logging when they are not configured
    // or not reachable, so `npm install && npm start` works out of the box.
    await connectDB();
    await connectRedis();

    const app = createApp();
    app.listen(PORT, () => {
      logger.info(`🚀 LLM Cost Optimizer Proxy running on port ${PORT}`);
      logger.info(`📊 Dashboard UI available at http://localhost:${PORT}/`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

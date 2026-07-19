import express from 'express';
import { requestStore } from '../services/RequestStore.js';
import { CacheService } from '../services/CacheService.js';
import { logger } from '../utils/logger.js';

const router = express.Router();
const cacheService = new CacheService();

// Get dashboard statistics
router.get('/stats', async (req, res) => {
  try {
    const timeframe = req.query.timeframe || '24h';

    const [stats, cacheStats] = await Promise.all([
      requestStore.getStats(timeframe),
      cacheService.getStats()
    ]);

    res.json({
      timeframe,
      ...stats,
      cacheStats
    });
  } catch (error) {
    logger.error('Dashboard stats error:', error.message);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

// Get detailed request logs
router.get('/requests', async (req, res) => {
  try {
    const { page = 1, limit = 50, model, cacheHit } = req.query;

    const result = await requestStore.listRequests({
      page,
      limit,
      model,
      cacheHit: cacheHit !== undefined ? cacheHit === 'true' : undefined
    });

    res.json(result);
  } catch (error) {
    logger.error('Dashboard requests error:', error.message);
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

// Clear cache
router.post('/cache/clear', async (req, res) => {
  try {
    await cacheService.clear();
    res.json({ message: 'Cache cleared successfully' });
  } catch (error) {
    logger.error('Cache clear error:', error.message);
    res.status(500).json({ error: 'Failed to clear cache' });
  }
});

export default router;

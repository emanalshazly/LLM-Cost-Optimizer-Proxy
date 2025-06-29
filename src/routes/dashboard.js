import express from 'express';
import Request from '../models/Request.js';
import { CacheService } from '../services/CacheService.js';
import { logger } from '../utils/logger.js';

const router = express.Router();
const cacheService = new CacheService();

// Get dashboard statistics
router.get('/stats', async (req, res) => {
  try {
    const { timeframe = '24h' } = req.query;
    
    let timeFilter = {};
    const now = new Date();
    
    switch (timeframe) {
      case '1h':
        timeFilter = { timestamp: { $gte: new Date(now - 60 * 60 * 1000) } };
        break;
      case '24h':
        timeFilter = { timestamp: { $gte: new Date(now - 24 * 60 * 60 * 1000) } };
        break;
      case '7d':
        timeFilter = { timestamp: { $gte: new Date(now - 7 * 24 * 60 * 60 * 1000) } };
        break;
      case '30d':
        timeFilter = { timestamp: { $gte: new Date(now - 30 * 24 * 60 * 60 * 1000) } };
        break;
    }

    const [
      totalRequests,
      cacheHits,
      totalCostSaved,
      avgProcessingTime,
      modelUsage,
      recentRequests
    ] = await Promise.all([
      Request.countDocuments(timeFilter),
      Request.countDocuments({ ...timeFilter, cacheHit: true }),
      Request.aggregate([
        { $match: timeFilter },
        { $group: { _id: null, total: { $sum: '$cost.saved' } } }
      ]),
      Request.aggregate([
        { $match: timeFilter },
        { $group: { _id: null, avg: { $avg: '$processingTime' } } }
      ]),
      Request.aggregate([
        { $match: timeFilter },
        { $group: { _id: '$model', count: { $sum: 1 }, cost: { $sum: '$cost.optimized' } } },
        { $sort: { count: -1 } }
      ]),
      Request.find(timeFilter)
        .sort({ timestamp: -1 })
        .limit(10)
        .select('requestId originalPrompt model cost processingTime cacheHit timestamp')
    ]);

    const cacheStats = await cacheService.getStats();

    res.json({
      timeframe,
      totalRequests,
      cacheHitRate: totalRequests > 0 ? (cacheHits / totalRequests * 100).toFixed(2) : 0,
      totalCostSaved: totalCostSaved[0]?.total || 0,
      avgProcessingTime: avgProcessingTime[0]?.avg || 0,
      modelUsage,
      recentRequests,
      cacheStats
    });

  } catch (error) {
    logger.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

// Get detailed request logs
router.get('/requests', async (req, res) => {
  try {
    const { page = 1, limit = 50, model, cacheHit } = req.query;
    
    let filter = {};
    if (model) filter.model = model;
    if (cacheHit !== undefined) filter.cacheHit = cacheHit === 'true';

    const requests = await Request.find(filter)
      .sort({ timestamp: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .select('-response'); // Exclude response content for performance

    const total = await Request.countDocuments(filter);

    res.json({
      requests,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    logger.error('Dashboard requests error:', error);
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

// Clear cache
router.post('/cache/clear', async (req, res) => {
  try {
    await cacheService.clear();
    res.json({ message: 'Cache cleared successfully' });
  } catch (error) {
    logger.error('Cache clear error:', error);
    res.status(500).json({ error: 'Failed to clear cache' });
  }
});

export default router;
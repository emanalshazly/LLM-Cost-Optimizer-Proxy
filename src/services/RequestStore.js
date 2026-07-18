import Request from '../models/Request.js';
import { isMongoConnected } from '../config/database.js';
import { logger } from '../utils/logger.js';

const MEMORY_LIMIT = 1000;
const memoryEntries = [];

function cutoffFor(timeframe) {
  const windows = {
    '1h': 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000
  };
  const windowMs = windows[timeframe];
  return windowMs ? new Date(Date.now() - windowMs) : null;
}

function mongoTimeFilter(timeframe) {
  const since = cutoffFor(timeframe);
  return since ? { timestamp: { $gte: since } } : {};
}

function inScope(entry, since) {
  return !since || new Date(entry.timestamp) >= since;
}

// Fields exposed in "recent requests" / list views (never the full response body).
function summaryView(entry) {
  return {
    requestId: entry.requestId,
    originalPrompt: entry.originalPrompt,
    model: entry.model,
    cost: entry.cost,
    processingTime: entry.processingTime,
    cacheHit: entry.cacheHit,
    timestamp: entry.timestamp
  };
}

/**
 * Request logging with graceful degradation.
 *
 * Writes go to MongoDB when connected; otherwise they are kept in a bounded
 * in-memory buffer (last 1000 requests) so the dashboard endpoints keep
 * working with zero infrastructure. Logging failures never break the proxy
 * response path.
 */
export class RequestStore {
  async record(entry) {
    if (isMongoConnected()) {
      try {
        await new Request(entry).save();
        return;
      } catch (error) {
        // Fall through to memory so the event is not lost.
        logger.error('Failed to persist request log to MongoDB:', error.message);
      }
    }

    memoryEntries.push({ ...entry });
    if (memoryEntries.length > MEMORY_LIMIT) {
      memoryEntries.splice(0, memoryEntries.length - MEMORY_LIMIT);
    }
  }

  async getStats(timeframe = '24h') {
    if (isMongoConnected()) {
      const timeFilter = mongoTimeFilter(timeframe);

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

      return {
        totalRequests,
        cacheHitRate: totalRequests > 0 ? (cacheHits / totalRequests * 100).toFixed(2) : 0,
        totalCostSaved: totalCostSaved[0]?.total || 0,
        avgProcessingTime: avgProcessingTime[0]?.avg || 0,
        modelUsage,
        recentRequests
      };
    }

    // In-memory fallback
    const since = cutoffFor(timeframe);
    const scoped = memoryEntries.filter((entry) => inScope(entry, since));

    const totalRequests = scoped.length;
    const cacheHits = scoped.filter((entry) => entry.cacheHit).length;
    const totalCostSaved = scoped.reduce((sum, entry) => sum + (entry.cost?.saved || 0), 0);
    const avgProcessingTime = totalRequests > 0
      ? scoped.reduce((sum, entry) => sum + (entry.processingTime || 0), 0) / totalRequests
      : 0;

    const usageByModel = new Map();
    for (const entry of scoped) {
      const bucket = usageByModel.get(entry.model) || { _id: entry.model, count: 0, cost: 0 };
      bucket.count += 1;
      bucket.cost += entry.cost?.optimized || 0;
      usageByModel.set(entry.model, bucket);
    }

    return {
      totalRequests,
      cacheHitRate: totalRequests > 0 ? (cacheHits / totalRequests * 100).toFixed(2) : 0,
      totalCostSaved,
      avgProcessingTime,
      modelUsage: [...usageByModel.values()].sort((a, b) => b.count - a.count),
      recentRequests: [...scoped]
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, 10)
        .map(summaryView)
    };
  }

  async listRequests({ page = 1, limit = 50, model, cacheHit } = {}) {
    const filter = {};
    if (model) filter.model = model;
    if (cacheHit !== undefined) filter.cacheHit = cacheHit;

    const pageNumber = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = Math.max(1, parseInt(limit, 10) || 50);

    if (isMongoConnected()) {
      const [requests, total] = await Promise.all([
        Request.find(filter)
          .sort({ timestamp: -1 })
          .limit(pageSize)
          .skip((pageNumber - 1) * pageSize)
          .select('-response'), // Exclude response content for performance
        Request.countDocuments(filter)
      ]);

      return {
        requests,
        pagination: {
          page: pageNumber,
          limit: pageSize,
          total,
          pages: Math.ceil(total / pageSize)
        }
      };
    }

    // In-memory fallback
    const filtered = memoryEntries
      .filter((entry) => filter.model === undefined || entry.model === filter.model)
      .filter((entry) => filter.cacheHit === undefined || entry.cacheHit === filter.cacheHit)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    const total = filtered.length;
    const requests = filtered
      .slice((pageNumber - 1) * pageSize, pageNumber * pageSize)
      .map(({ response, ...rest }) => rest); // Exclude response content

    return {
      requests,
      pagination: {
        page: pageNumber,
        limit: pageSize,
        total,
        pages: Math.ceil(total / pageSize)
      }
    };
  }

  // Test helper: direct access to the in-memory buffer.
  _memoryEntries() {
    return memoryEntries;
  }
}

export const requestStore = new RequestStore();

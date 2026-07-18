import { describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';

process.env.NODE_ENV = 'test';
process.env.ENABLE_CACHING = 'true';
delete process.env.MONGODB_URI;
delete process.env.REDIS_URL;

const { createApp } = await import('../src/app.js');
const { requestStore } = await import('../src/services/RequestStore.js');

function seedEntry(overrides = {}) {
  return {
    requestId: 'r1',
    originalPrompt: 'prompt a',
    optimizedPrompt: 'prompt a',
    model: 'claude-3-haiku-20240307',
    originalModel: 'gpt-4',
    provider: 'openai',
    response: 'answer a',
    tokensUsed: { input: 10, output: 5, total: 15 },
    cost: { original: 0.002, optimized: 0.0001, saved: 0.0019 },
    processingTime: 100,
    cacheHit: false,
    timestamp: new Date(),
    ...overrides
  };
}

describe('dashboard endpoints (in-memory request store)', () => {
  beforeEach(() => {
    requestStore._memoryEntries().length = 0;
  });

  it('GET /api/dashboard/stats aggregates the seeded requests', async () => {
    await requestStore.record(seedEntry());
    await requestStore.record(seedEntry({
      requestId: 'r2',
      model: 'gpt-4',
      cacheHit: true,
      cost: { original: 0.003, optimized: 0, saved: 0.003 },
      processingTime: 20
    }));

    const res = await request(createApp()).get('/api/dashboard/stats?timeframe=24h');

    expect(res.status).toBe(200);
    expect(res.body.totalRequests).toBe(2);
    expect(res.body.cacheHitRate).toBe('50.00');
    expect(res.body.totalCostSaved).toBeCloseTo(0.0049);
    expect(res.body.avgProcessingTime).toBeCloseTo(60);
    expect(res.body.modelUsage).toHaveLength(2);
    expect(res.body.recentRequests).toHaveLength(2);
    expect(res.body.cacheStats.backend).toBe('memory');
  });

  it('GET /api/dashboard/stats handles an empty store', async () => {
    const res = await request(createApp()).get('/api/dashboard/stats');

    expect(res.status).toBe(200);
    expect(res.body.totalRequests).toBe(0);
    expect(res.body.totalCostSaved).toBe(0);
  });

  it('GET /api/dashboard/requests paginates and strips response bodies', async () => {
    await requestStore.record(seedEntry({ requestId: 'r1' }));
    await requestStore.record(seedEntry({ requestId: 'r2', cacheHit: true }));
    await requestStore.record(seedEntry({ requestId: 'r3' }));

    const res = await request(createApp()).get('/api/dashboard/requests?page=2&limit=2');

    expect(res.status).toBe(200);
    expect(res.body.pagination).toEqual({ page: 2, limit: 2, total: 3, pages: 2 });
    expect(res.body.requests).toHaveLength(1);
    expect(res.body.requests[0].response).toBeUndefined();
  });

  it('GET /api/dashboard/requests filters by cacheHit', async () => {
    await requestStore.record(seedEntry({ requestId: 'r1', cacheHit: false }));
    await requestStore.record(seedEntry({ requestId: 'r2', cacheHit: true }));

    const res = await request(createApp()).get('/api/dashboard/requests?cacheHit=true');

    expect(res.status).toBe(200);
    expect(res.body.pagination.total).toBe(1);
    expect(res.body.requests[0].requestId).toBe('r2');
  });

  it('POST /api/dashboard/cache/clear works without Redis', async () => {
    const res = await request(createApp()).post('/api/dashboard/cache/clear');

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/cleared/i);
  });
});

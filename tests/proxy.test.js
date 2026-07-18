import { describe, it, expect, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

process.env.NODE_ENV = 'test';

const { createProxyRouter } = await import('../src/routes/proxy.js');

const chainResult = {
  finalResponse: 'mocked answer',
  modelUsed: 'claude-3-haiku-20240307',
  optimizedPrompt: 'optimized prompt',
  tokensUsed: { input: 10, output: 5, total: 15 },
  cost: { original: 0.001, optimized: 0.0001, saved: 0.0009 },
  processingTime: 42,
  optimizationApplied: true,
  routingReason: 'simple task',
  cacheHit: false
};

function buildApp(overrides = {}) {
  const agentChain = {
    processRequest: jest.fn().mockResolvedValue(chainResult),
    ...(overrides.agentChain || {})
  };
  const cacheService = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    ...(overrides.cacheService || {})
  };
  const store = {
    record: jest.fn().mockResolvedValue(undefined),
    ...(overrides.requestStore || {})
  };

  const app = express();
  app.use(express.json());
  app.use('/api/proxy', createProxyRouter({
    agentChain,
    cacheService,
    requestStore: store
  }));

  return { app, agentChain, cacheService, store };
}

describe('POST /api/proxy/chat — validation', () => {
  it('rejects a missing prompt with 400', async () => {
    const { app, agentChain } = buildApp();
    const res = await request(app).post('/api/proxy/chat').send({});

    expect(res.status).toBe(400);
    expect(res.body.requestId).toBeDefined();
    expect(agentChain.processRequest).not.toHaveBeenCalled();
  });

  it('rejects an empty prompt with 400', async () => {
    const { app } = buildApp();
    const res = await request(app).post('/api/proxy/chat').send({ prompt: '   ' });

    expect(res.status).toBe(400);
  });

  it('rejects a non-string prompt with 400', async () => {
    const { app } = buildApp();
    const res = await request(app).post('/api/proxy/chat').send({ prompt: 42 });

    expect(res.status).toBe(400);
  });

  it('rejects an unsupported provider with 400', async () => {
    const { app } = buildApp();
    const res = await request(app)
      .post('/api/proxy/chat')
      .send({ prompt: 'hello', provider: 'google' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Unsupported provider/);
  });
});

describe('POST /api/proxy/chat — happy path', () => {
  it('routes through the agent chain and returns the result', async () => {
    const { app, agentChain, cacheService, store } = buildApp();
    const res = await request(app)
      .post('/api/proxy/chat')
      .send({ prompt: 'Explain DNS in one sentence', model: 'gpt-4', provider: 'openai' });

    expect(res.status).toBe(200);
    expect(res.body.response).toBe('mocked answer');
    expect(res.body.model).toBe('claude-3-haiku-20240307');
    expect(res.body.cost.saved).toBeCloseTo(0.0009);
    expect(res.body.cacheHit).toBe(false);
    expect(res.body.requestId).toBeDefined();

    expect(agentChain.processRequest).toHaveBeenCalledWith('Explain DNS in one sentence', 'gpt-4');

    // Cached under the *requested* model key so repeat lookups hit.
    expect(cacheService.set).toHaveBeenCalledWith(
      'Explain DNS in one sentence',
      'gpt-4',
      expect.objectContaining({ response: 'mocked answer', modelUsed: 'claude-3-haiku-20240307' })
    );

    // Logged with the real optimized prompt (not a placeholder string).
    expect(store.record).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'claude-3-haiku-20240307',
        originalModel: 'gpt-4',
        optimizedPrompt: 'optimized prompt',
        cacheHit: false
      })
    );
  });

  it('serves cache hits without calling the LLM chain', async () => {
    const cachedEntry = {
      response: 'cached answer',
      modelUsed: 'claude-3-haiku-20240307',
      tokensUsed: { input: 10, output: 5, total: 15 },
      cost: { original: 0.001, optimized: 0.0001, saved: 0.0009 }
    };
    const { app, agentChain, store } = buildApp({
      cacheService: { get: jest.fn().mockResolvedValue(cachedEntry) }
    });

    const res = await request(app)
      .post('/api/proxy/chat')
      .send({ prompt: 'What is 2+2?', model: 'gpt-4' });

    expect(res.status).toBe(200);
    expect(res.body.response).toBe('cached answer');
    expect(res.body.cacheHit).toBe(true);
    expect(agentChain.processRequest).not.toHaveBeenCalled();
    expect(store.record).toHaveBeenCalledWith(
      expect.objectContaining({ cacheHit: true })
    );
  });

  it('returns 502 when the upstream LLM call fails', async () => {
    const { app } = buildApp({
      agentChain: { processRequest: jest.fn().mockRejectedValue(new Error('ANTHROPIC_API_KEY is not configured')) }
    });

    const res = await request(app)
      .post('/api/proxy/chat')
      .send({ prompt: 'hello' });

    expect(res.status).toBe(502);
    expect(res.body.requestId).toBeDefined();
    expect(res.body.message).toMatch(/ANTHROPIC_API_KEY/);
  });
});

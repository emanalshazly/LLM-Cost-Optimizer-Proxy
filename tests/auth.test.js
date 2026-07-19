import { describe, it, expect, jest, afterEach } from '@jest/globals';
import request from 'supertest';

process.env.NODE_ENV = 'test';
delete process.env.MONGODB_URI;
delete process.env.REDIS_URL;

const { requireApiKey } = await import('../src/middleware/auth.js');
const { createApp } = await import('../src/app.js');

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

function mockReqRes(headers = {}) {
  const req = { get: (name) => headers[name.toLowerCase()] };
  const res = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    }
  };
  return { req, res };
}

describe('requireApiKey (unit)', () => {
  it('allows requests through when API_KEY is not configured', () => {
    delete process.env.API_KEY;
    const { req, res } = mockReqRes();
    const next = jest.fn();

    requireApiKey(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.statusCode).toBeNull();
  });

  it('rejects requests missing the x-api-key header when configured', () => {
    process.env.API_KEY = 'secret123';
    const { req, res } = mockReqRes();
    const next = jest.fn();

    requireApiKey(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });

  it('rejects requests with a wrong x-api-key header', () => {
    process.env.API_KEY = 'secret123';
    const { req, res } = mockReqRes({ 'x-api-key': 'wrong' });
    const next = jest.fn();

    requireApiKey(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });

  it('allows requests with the correct x-api-key header', () => {
    process.env.API_KEY = 'secret123';
    const { req, res } = mockReqRes({ 'x-api-key': 'secret123' });
    const next = jest.fn();

    requireApiKey(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.statusCode).toBeNull();
  });
});

describe('API_KEY gating (integration via createApp)', () => {
  it('leaves /api/dashboard and /api/proxy open when API_KEY is unset', async () => {
    delete process.env.API_KEY;
    const app = createApp();

    const dashboardRes = await request(app).get('/api/dashboard/stats');
    expect(dashboardRes.status).toBe(200);
  });

  it('blocks /api/dashboard without the header once API_KEY is set', async () => {
    process.env.API_KEY = 'secret123';
    const app = createApp();

    const res = await request(app).get('/api/dashboard/stats');
    expect(res.status).toBe(401);
  });

  it('allows /api/dashboard with the correct x-api-key header', async () => {
    process.env.API_KEY = 'secret123';
    const app = createApp();

    const res = await request(app).get('/api/dashboard/stats').set('x-api-key', 'secret123');
    expect(res.status).toBe(200);
  });

  it('never gates /api/health, even with API_KEY set', async () => {
    process.env.API_KEY = 'secret123';
    const app = createApp();

    const res = await request(app).get('/api/health');
    expect(res.status).not.toBe(401);
  });

  it('serves the static dashboard UI without a key', async () => {
    process.env.API_KEY = 'secret123';
    const app = createApp();

    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('LLM Cost Optimizer');
  });
});

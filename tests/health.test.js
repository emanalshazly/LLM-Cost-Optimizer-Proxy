import { describe, it, expect } from '@jest/globals';
import request from 'supertest';

process.env.NODE_ENV = 'test';
delete process.env.MONGODB_URI;
delete process.env.REDIS_URL;

const { createApp } = await import('../src/app.js');

describe('GET /api/health', () => {
  it('reports ok with optional infra disabled', async () => {
    const res = await request(createApp()).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.services.mongodb).toBe('disabled');
    expect(res.body.services.redis).toBe('disabled');
    expect(typeof res.body.timestamp).toBe('string');
  });
});

describe('unknown routes', () => {
  it('return a JSON 404', async () => {
    const res = await request(createApp()).get('/api/does-not-exist');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Not Found');
  });
});

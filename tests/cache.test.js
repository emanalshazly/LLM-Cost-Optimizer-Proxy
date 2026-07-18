import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

process.env.NODE_ENV = 'test';
process.env.ENABLE_CACHING = 'true';
process.env.CACHE_TTL = '60';
delete process.env.REDIS_URL;

const { CacheService } = await import('../src/services/CacheService.js');

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

/** Minimal Redis-compatible fake backed by a Map. */
function fakeRedisClient() {
  const map = new Map();
  return {
    map,
    async get(key) {
      return map.has(key) ? map.get(key) : null;
    },
    async setEx(key, ttl, value) {
      map.set(key, value);
    },
    async del(keys) {
      const list = Array.isArray(keys) ? keys : [keys];
      list.forEach((key) => map.delete(key));
    },
    async keys(pattern) {
      const prefix = pattern.replace('*', '');
      return [...map.keys()].filter((key) => key.startsWith(prefix));
    }
  };
}

describe('CacheService with a Redis backend', () => {
  let client;
  let cache;

  beforeEach(() => {
    client = fakeRedisClient();
    cache = new CacheService({ client });
  });

  it('misses first, then hits after set', async () => {
    expect(await cache.get('hello', 'gpt-4')).toBeNull();

    await cache.set('hello', 'gpt-4', { response: 'hi', modelUsed: 'claude-3-haiku-20240307' });

    const hit = await cache.get('hello', 'gpt-4');
    expect(hit.response).toBe('hi');
    expect(hit.modelUsed).toBe('claude-3-haiku-20240307');
  });

  it('keys are model-sensitive: same prompt, different model = miss', async () => {
    await cache.set('hello', 'gpt-4', { response: 'hi' });

    expect(await cache.get('hello', 'gpt-3.5-turbo')).toBeNull();
  });

  it('stores entries under hashed keys, never raw prompts', async () => {
    await cache.set('super secret prompt', 'gpt-4', { response: 'hi' });

    const keys = [...client.map.keys()];
    expect(keys).toHaveLength(1);
    expect(keys[0]).toMatch(/^llm_cache:[a-f0-9]{64}$/);
    expect(keys[0]).not.toContain('super secret');
  });

  it('clear() removes all llm_cache entries', async () => {
    await cache.set('a', 'gpt-4', { response: '1' });
    await cache.set('b', 'gpt-4', { response: '2' });

    await cache.clear();

    expect(await cache.get('a', 'gpt-4')).toBeNull();
    expect(await cache.getStats()).toMatchObject({ backend: 'redis', totalEntries: 0 });
  });

  it('does nothing when caching is disabled', async () => {
    const disabled = new CacheService({ client, enabled: false });

    await disabled.set('hello', 'gpt-4', { response: 'hi' });

    expect(await disabled.get('hello', 'gpt-4')).toBeNull();
    expect(client.map.size).toBe(0);
  });
});

describe('CacheService in-memory fallback (no Redis)', () => {
  it('caches without any client configured', async () => {
    const cache = new CacheService(); // no client, Redis not connected

    expect(cache.backend()).toBe('memory');

    expect(await cache.get('hello', 'gpt-4')).toBeNull();
    await cache.set('hello', 'gpt-4', { response: 'hi' });

    const hit = await cache.get('hello', 'gpt-4');
    expect(hit.response).toBe('hi');

    const stats = await cache.getStats();
    expect(stats.backend).toBe('memory');
    expect(stats.totalEntries).toBe(1);
  });

  it('expires entries after the TTL', async () => {
    const cache = new CacheService({ ttl: 0 }); // expires immediately

    await cache.set('hello', 'gpt-4', { response: 'hi' });

    expect(await cache.get('hello', 'gpt-4')).toBeNull();
  });

  it('clear() empties the in-memory cache', async () => {
    const cache = new CacheService();

    await cache.set('a', 'gpt-4', { response: '1' });
    await cache.clear();

    expect((await cache.getStats()).totalEntries).toBe(0);
  });
});

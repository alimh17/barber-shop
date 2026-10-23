import { afterEach, describe, expect, it } from 'vitest';
import { RedisService } from './redis.service.js';

describe('RedisService memory development mode', () => {
  const previousMode = process.env.REDIS_MODE;
  const previousNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.REDIS_MODE = previousMode;
    process.env.NODE_ENV = previousNodeEnv;
  });

  it('supports expiring counters and cache operations without Redis', async () => {
    process.env.REDIS_MODE = 'memory';
    process.env.NODE_ENV = 'development';
    const service = new RedisService();
    await expect(service.incrementWithExpiry('rate', 1_000)).resolves.toBe(1);
    await expect(service.incrementWithExpiry('rate', 1_000)).resolves.toBe(2);
    await service.setCache('profile', { id: 1 }, 10);
    await expect(service.getCache('profile')).resolves.toEqual({ id: 1 });
    await service.deleteCache('profile');
    await expect(service.getCache('profile')).resolves.toBeNull();
    await service.onModuleDestroy();
  });

  it('rejects memory mode in production', () => {
    process.env.REDIS_MODE = 'memory';
    process.env.NODE_ENV = 'production';
    expect(() => new RedisService()).toThrow('not allowed in production');
  });
});

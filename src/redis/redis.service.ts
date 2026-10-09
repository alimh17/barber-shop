import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';

const incrementScript = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
return count
`;

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis;

  constructor() {
    this.client = new Redis(process.env.REDIS_URL ?? 'redis://127.0.0.1:6379/0', {
      lazyConnect: true,
      enableReadyCheck: true,
      maxRetriesPerRequest: 1,
      retryStrategy: (attempt) => Math.min(attempt * 250, 3000),
    });

    this.client.on('error', (error: Error) => {
      this.logger.error(`Redis connection error: ${error.message}`);
    });

    // With lazyConnect enabled, the first Redis command opens the connection.
    // This keeps application startup independent from Redis; OTP routes fail closed
    // if Redis is unavailable, while cache callers can decide how to degrade.
  }

  async incrementWithExpiry(key: string, ttlMs: number): Promise<number> {
    const result = await this.client.eval(incrementScript, 1, key, String(ttlMs));
    return Number(result);
  }

  async getCache<T>(key: string): Promise<T | null> {
    const value = await this.client.get(`cache:${key}`);
    if (value === null) return null;

    try {
      return JSON.parse(value) as T;
    } catch {
      await this.client.del(`cache:${key}`);
      return null;
    }
  }

  async setCache(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    if (!Number.isFinite(ttlSeconds) || ttlSeconds < 1) {
      throw new Error('Cache TTL must be a positive number of seconds');
    }

    await this.client.set(`cache:${key}`, JSON.stringify(value), 'EX', Math.floor(ttlSeconds));
  }

  async deleteCache(key: string): Promise<void> {
    await this.client.del(`cache:${key}`);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client.status === 'end') return;
    if (this.client.status === 'wait') {
      this.client.disconnect();
      return;
    }
    await this.client.quit().catch(() => this.client.disconnect());
  }
}

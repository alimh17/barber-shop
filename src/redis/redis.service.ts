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
  private readonly client: Redis | null;
  private readonly memory = new Map<string, { value: string; expiresAt: number }>();

  constructor() {
    if (process.env.REDIS_MODE === 'memory') {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('REDIS_MODE=memory is not allowed in production');
      }
      this.client = null;
      this.logger.warn('Using in-memory Redis fallback for local development');
      return;
    }

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
    if (!this.client) {
      const now = Date.now();
      const current = this.memory.get(key);
      const count = current && current.expiresAt > now ? Number(current.value) + 1 : 1;
      this.memory.set(key, { value: String(count), expiresAt: current?.expiresAt && current.expiresAt > now ? current.expiresAt : now + ttlMs });
      return count;
    }
    const result = await this.client.eval(incrementScript, 1, key, String(ttlMs));
    return Number(result);
  }

  async getCache<T>(key: string): Promise<T | null> {
    if (!this.client) {
      const item = this.memory.get(`cache:${key}`);
      if (!item || item.expiresAt <= Date.now()) {
        this.memory.delete(`cache:${key}`);
        return null;
      }
      try { return JSON.parse(item.value) as T; } catch { this.memory.delete(`cache:${key}`); return null; }
    }
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

    if (!this.client) {
      this.memory.set(`cache:${key}`, { value: JSON.stringify(value), expiresAt: Date.now() + Math.floor(ttlSeconds) * 1000 });
      return;
    }
    await this.client.set(`cache:${key}`, JSON.stringify(value), 'EX', Math.floor(ttlSeconds));
  }

  async deleteCache(key: string): Promise<void> {
    if (!this.client) { this.memory.delete(`cache:${key}`); return; }
    await this.client.del(`cache:${key}`);
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.client) { this.memory.clear(); return; }
    const client = this.client;
    if (client.status === 'end') return;
    if (client.status === 'wait') {
      client.disconnect();
      return;
    }
    await client.quit().catch(() => client.disconnect());
  }
}

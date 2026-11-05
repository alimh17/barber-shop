import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

type Counters = { requests: number; errors: number; totalDurationMs: number };
const counters: Counters = { requests: 0, errors: 0, totalDurationMs: 0 };

export function getHttpMetrics(): Counters {
  return { ...counters };
}

export function httpTelemetry(req: Request, res: Response, next: NextFunction): void {
  const requestId = randomUUID();
  const start = process.hrtime.bigint();
  res.setHeader('X-Request-Id', requestId);
  res.locals.requestId = requestId;
  res.once('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
    counters.requests++;
    counters.totalDurationMs += durationMs;
    if (res.statusCode >= 500) counters.errors++;
    const status = res.statusCode;
    const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
    // Never log URLs, query strings, headers, request bodies, phone numbers or tokens.
    const route = req.route?.path as string | undefined;
    const payload = {
      timestamp: new Date().toISOString(),
      level,
      event: 'http_request',
      requestId,
      method: req.method,
      route: typeof route === 'string' ? route : 'unmatched',
      status,
      durationMs: Math.round(durationMs * 100) / 100,
    };
    if (process.env.HTTP_LOG_LEVEL !== 'off' && (process.env.HTTP_LOG_LEVEL === 'all' || status >= 400)) {
      process.stdout.write(JSON.stringify(payload) + '\n');
    }
  });
  next();
}

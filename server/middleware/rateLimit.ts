import { rateLimit, type Options } from 'express-rate-limit';
import type { Request, Response } from 'express';

/**
 * Standard DecisionVault error response returned when rate limit is exceeded.
 */
export const rateLimitHandler = (_req: Request, res: Response): void => {
  res.status(429).json({
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many requests. Please slow down.',
    },
  });
};

/**
 * Factory to create custom rate limiters with DecisionVault standard error format.
 */
export function createRateLimiter(options?: Partial<Options>) {
  return rateLimit({
    windowMs: process.env.RATE_LIMIT_WINDOW_MS
      ? parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10)
      : 15 * 60 * 1000, // 15 minutes default
    limit: process.env.RATE_LIMIT_MAX
      ? parseInt(process.env.RATE_LIMIT_MAX, 10)
      : process.env.NODE_ENV === 'test'
        ? 1000
        : 100,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: rateLimitHandler,
    ...options,
  });
}

/**
 * Standard rate limiter for database queries and resource-heavy operations.
 * Defaults to 100 requests per 15 minutes (or 1000 in test mode).
 */
export const standardRateLimiter = createRateLimiter();

/**
 * Lenient rate limiter for health check and status polling endpoints.
 * Ensures frequent UI polling and monitoring probes are not aggressively throttled.
 */
export const pollingRateLimiter = createRateLimiter({
  limit: process.env.RATE_LIMIT_MAX
    ? parseInt(process.env.RATE_LIMIT_MAX, 10) * 10
    : process.env.NODE_ENV === 'test'
      ? 10000
      : 2000,
});

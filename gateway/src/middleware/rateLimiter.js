/**
 * Fleet Management System – Third-party Integrations, API Gateway
 * Author : Ashfaaq Feroz Muhammad | BITS ID: 2023EBCS005
 * Course : Backend and API Development – BITS Pilani
 * File   : gateway/src/middleware/rateLimiter.js – per-API-key rate limiting with tier-based limits
 */
const { rateLimit } = require('express-rate-limit');
const { ApiError } = require('@fleet/shared');

/**
 * Fixed-window limiter (in-memory store, one per gateway instance).
 * - Bucket: the API key (falls back to client IP if no key is known).
 * - Limit: `max` for standard keys, `maxPremium` for premium keys, `maxDemo` for demo keys.
 * - Sends RateLimit-Limit / RateLimit-Remaining / RateLimit-Reset headers on every
 *   response and Retry-After + 429 RATE_LIMIT_EXCEEDED when the bucket is empty.
 */
function createRateLimiter({ windowMs, max, maxPremium, maxDemo }) {
  // Per-tier limits. The `demo` tier has a tiny limit so a 429 is easy to show live.
  const limits = { standard: max, premium: maxPremium, demo: maxDemo };
  return rateLimit({
    windowMs,
    limit: (req) => (req.apiKey && limits[req.apiKey.tier] !== undefined ? limits[req.apiKey.tier] : max),
    standardHeaders: 'draft-6',
    legacyHeaders: false,
    keyGenerator: (req) => (req.apiKey ? `key:${req.apiKey.key}` : `ip:${req.ip}`),
    handler: (req, res, _next, options) => {
      const retryAfter = res.getHeader('Retry-After') || Math.ceil(options.windowMs / 1000);
      const err = new ApiError(
        429,
        'RATE_LIMIT_EXCEEDED',
        `Too many requests for this API key. Try again in ${retryAfter} seconds.`,
        { limit: options.limit instanceof Function ? undefined : options.limit, retryAfterSeconds: Number(retryAfter) }
      );
      res.status(429).json(err.toJSON());
    },
  });
}

module.exports = { createRateLimiter };

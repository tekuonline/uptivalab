/**
 * Rate limiting configuration for different API endpoints
 * 
 * This module provides endpoint-specific rate limits for expensive operations
 * to prevent resource abuse while allowing normal API usage.
 */

export interface RateLimitConfig {
  max: number;          // Maximum requests
  timeWindow: string;   // Time window (e.g., "1 minute", "1 hour")
  ban?: number;         // Optional ban duration in milliseconds after limit exceeded
}

/**
 * Rate limit configurations for different endpoint types
 */
export const RATE_LIMITS = {
  // Global default (applied to all routes unless overridden)
  GLOBAL: {
    max: 500,
    timeWindow: '1 minute',
  } as RateLimitConfig,

  // Authentication endpoints - lower limits to prevent brute force
  AUTH_LOGIN: {
    max: 10,
    timeWindow: '1 minute',
    ban: 300000, // 5 minute ban after exceeding limit
  } as RateLimitConfig,

  AUTH_REGISTER: {
    max: 5,
    timeWindow: '1 hour',
  } as RateLimitConfig,

  AUTH_PASSWORD_RESET: {
    max: 3,
    timeWindow: '1 hour',
  } as RateLimitConfig,

  // Expensive operations - lower limits to prevent resource exhaustion
  MONITOR_CREATE: {
    max: 20,
    timeWindow: '1 minute',
  } as RateLimitConfig,

  MONITOR_RUN: {
    max: 30,
    timeWindow: '1 minute',
  } as RateLimitConfig,

  SYNTHETIC_TEST: {
    max: 10,
    timeWindow: '1 minute',
  } as RateLimitConfig,

  SYNTHETIC_RECORDER: {
    max: 5,
    timeWindow: '1 minute',
  } as RateLimitConfig,

  // Docker operations
  DOCKER_TEST: {
    max: 10,
    timeWindow: '1 minute',
  } as RateLimitConfig,

  DOCKER_RESOURCES: {
    max: 20,
    timeWindow: '1 minute',
  } as RateLimitConfig,

  // Database queries
  EXPORT_DATA: {
    max: 3,
    timeWindow: '10 minutes',
  } as RateLimitConfig,

  IMPORT_DATA: {
    max: 3,
    timeWindow: '10 minutes',
  } as RateLimitConfig,

  // Notification testing
  NOTIFICATION_TEST: {
    max: 5,
    timeWindow: '1 minute',
  } as RateLimitConfig,

  // Bulk operations
  BULK_UPDATE: {
    max: 10,
    timeWindow: '1 minute',
  } as RateLimitConfig,

  // Status page access - higher limits for public pages
  PUBLIC_STATUS: {
    max: 100,
    timeWindow: '1 minute',
  } as RateLimitConfig,

  // Heartbeat/Push monitoring - higher limits for frequent checks
  HEARTBEAT_PUSH: {
    max: 200,
    timeWindow: '1 minute',
  } as RateLimitConfig,

  // API Key creation - very limited to prevent abuse
  API_KEY_CREATE: {
    max: 5,
    timeWindow: '1 hour',
  } as RateLimitConfig,
} as const;

/**
 * Get rate limit configuration for a specific endpoint type
 */
export function getRateLimitConfig(endpointType: keyof typeof RATE_LIMITS): RateLimitConfig {
  return RATE_LIMITS[endpointType];
}

/**
 * Create a rate limit options object for Fastify
 */
export function createRateLimitOptions(config: RateLimitConfig) {
  return {
    max: config.max,
    timeWindow: config.timeWindow,
    ...(config.ban ? { ban: config.ban } : {}),
  };
}

/**
 * Helper to create route-specific rate limiter
 * 
 * Usage:
 * ```typescript
 * fastify.post('/auth/login', {
 *   config: { rateLimit: createRateLimitOptions(RATE_LIMITS.AUTH_LOGIN) }
 * }, handler);
 * ```
 */
export { createRateLimitOptions as rateLimitFor };

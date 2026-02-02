/**
 * Common Zod validation schemas for API endpoints
 * 
 * This module provides reusable validation schemas for query parameters,
 * common data types, and API request/response validation.
 */

import { z } from 'zod';

/**
 * Pagination query parameters schema
 */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

/**
 * Sorting query parameters schema
 */
export const sortQuerySchema = z.object({
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc').optional(),
});

/**
 * Field filtering query parameters schema
 */
export const fieldsQuerySchema = z.object({
  fields: z.string().optional(), // Comma-separated list of fields
});

/**
 * Date range query parameters schema
 */
export const dateRangeQuerySchema = z.object({
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

/**
 * Common ID parameter schema
 */
export const idParamSchema = z.object({
  id: z.string().min(1),
});

/**
 * UUID schema
 */
export const uuidSchema = z.string().uuid();

/**
 * CUID schema (common ID format used by Prisma)
 */
export const cuidSchema = z.string().regex(/^c[a-z0-9]{24}$/i);

/**
 * Email schema with validation
 */
export const emailSchema = z.string().email().toLowerCase();

/**
 * Password schema with requirements
 */
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must not exceed 128 characters');

/**
 * URL schema with validation
 */
export const urlSchema = z.string().url();

/**
 * Monitor status enum
 */
export const monitorStatusSchema = z.enum(['up', 'down', 'degraded', 'unknown']);

/**
 * Monitor kind enum
 */
export const monitorKindSchema = z.enum([
  'http',
  'tcp',
  'ping',
  'dns',
  'docker',
  'certificate',
  'database',
  'synthetic',
  'grpc',
  'push',
]);

/**
 * Incident status enum
 */
export const incidentStatusSchema = z.enum([
  'OPEN',
  'INVESTIGATING',
  'MITIGATED',
  'RESOLVED',
]);

/**
 * User role enum
 */
export const userRoleSchema = z.enum(['ADMIN', 'USER']);

/**
 * Notification type enum
 */
export const notificationTypeSchema = z.enum([
  'email',
  'ntfy',
  'discord',
  'slack',
  'telegram',
  'gotify',
  'pushover',
  'webhook',
  'apprise',
]);

/**
 * Monitor configuration base schema
 */
export const monitorConfigBaseSchema = z.object({
  url: z.string().url().optional(),
  interval: z.number().int().positive().min(30000).optional(), // Minimum 30 seconds
  timeout: z.number().int().positive().max(30000).optional(), // Maximum 30 seconds
});

/**
 * HTTP monitor config schema
 */
export const httpMonitorConfigSchema = z.object({
  url: z.string().url(),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'OPTIONS']).default('GET'),
  headers: z.record(z.string()).optional(),
  body: z.string().optional(),
  expectedStatusCode: z.number().int().min(100).max(599).default(200),
  keyword: z.string().optional(),
  followRedirects: z.boolean().default(true),
  validateSSL: z.boolean().default(true),
});

/**
 * TCP monitor config schema
 */
export const tcpMonitorConfigSchema = z.object({
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535),
});

/**
 * Ping monitor config schema
 */
export const pingMonitorConfigSchema = z.object({
  host: z.string().min(1),
  count: z.number().int().min(1).max(10).default(3).optional(),
});

/**
 * DNS monitor config schema
 */
export const dnsMonitorConfigSchema = z.object({
  hostname: z.string().min(1),
  recordType: z.enum(['A', 'AAAA', 'MX', 'TXT', 'CNAME', 'NS']).default('A').optional(),
  expectedValue: z.string().optional(),
  nameserver: z.string().optional(),
});

/**
 * Certificate monitor config schema
 */
export const certificateMonitorConfigSchema = z.object({
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535).default(443).optional(),
  warningDays: z.number().int().min(1).max(365).default(30).optional(),
});

/**
 * Docker monitor config schema
 */
export const dockerMonitorConfigSchema = z.object({
  dockerHostId: z.string().optional(),
  containerName: z.string().min(1),
  checkUpdates: z.boolean().default(false).optional(),
});

/**
 * Database monitor config schema
 */
export const databaseMonitorConfigSchema = z.object({
  connectionString: z.string().min(1),
  databaseType: z.enum(['postgres', 'mysql', 'mariadb', 'redis', 'mongodb']),
  query: z.string().optional(),
});

/**
 * Synthetic monitor config schema
 */
export const syntheticMonitorConfigSchema = z.object({
  browser: z.enum(['chromium', 'firefox', 'webkit']).default('chromium').optional(),
  useLocalBrowser: z.boolean().default(true).optional(),
  remoteBrowserId: z.string().optional(),
  baseUrl: z.string().url().optional(),
  steps: z.array(z.object({
    action: z.string(),
    selector: z.string().optional(),
    value: z.string().optional(),
    url: z.string().optional(),
    timeout: z.number().optional(),
  })).min(1),
  ignoreHTTPSErrors: z.boolean().default(false).optional(),
  captureScreenshots: z.boolean().default(true).optional(),
});

/**
 * Heartbeat/Push monitor config schema
 */
export const pushMonitorConfigSchema = z.object({
  gracePeriod: z.number().int().positive().min(60).optional(), // Minimum 1 minute
  expectedInterval: z.number().int().positive().min(60).optional(),
});

/**
 * Notification channel config schemas by type
 */
export const emailNotificationConfigSchema = z.object({
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  user: z.string().min(1),
  password: z.string().min(1),
  from: emailSchema,
  to: z.union([emailSchema, z.array(emailSchema)]),
  secure: z.boolean().default(true).optional(),
});

export const webhookNotificationConfigSchema = z.object({
  url: urlSchema,
  method: z.enum(['GET', 'POST', 'PUT']).default('POST').optional(),
  headers: z.record(z.string()).optional(),
});

export const discordNotificationConfigSchema = z.object({
  webhookUrl: urlSchema,
  username: z.string().optional(),
  avatarUrl: urlSchema.optional(),
});

export const slackNotificationConfigSchema = z.object({
  webhookUrl: urlSchema,
  channel: z.string().optional(),
});

export const telegramNotificationConfigSchema = z.object({
  botToken: z.string().min(1),
  chatId: z.string().min(1),
});

/**
 * Maintenance window schema
 */
export const maintenanceWindowSchema = z.object({
  name: z.string().min(1).max(255),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  monitorIds: z.array(z.string()).min(1),
  description: z.string().optional(),
}).refine(
  (data) => data.endsAt > data.startsAt,
  { message: 'End date must be after start date', path: ['endsAt'] }
);

/**
 * Status page schema
 */
export const statusPageSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(255).regex(/^[a-z0-9-]+$/),
  description: z.string().optional(),
  monitorIds: z.array(z.string()).min(1),
  isPublic: z.boolean().default(true).optional(),
});

/**
 * Helper to combine pagination with other query schemas
 */
export function withPagination<T extends z.ZodRawShape>(schema: z.ZodObject<T>) {
  return schema.merge(paginationQuerySchema);
}

/**
 * Helper to combine sorting with other query schemas
 */
export function withSorting<T extends z.ZodRawShape>(schema: z.ZodObject<T>) {
  return schema.merge(sortQuerySchema);
}

/**
 * Helper to combine field filtering with other query schemas
 */
export function withFields<T extends z.ZodRawShape>(schema: z.ZodObject<T>) {
  return schema.merge(fieldsQuerySchema);
}

/**
 * Helper to combine multiple query modifiers
 */
export function withQueryModifiers<T extends z.ZodRawShape>(schema: z.ZodObject<T>) {
  return schema
    .merge(paginationQuerySchema)
    .merge(sortQuerySchema)
    .merge(fieldsQuerySchema);
}

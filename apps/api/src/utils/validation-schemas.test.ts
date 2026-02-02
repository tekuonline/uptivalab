/**
 * Unit tests for validation schemas
 */

import { describe, it, expect } from 'vitest';
import {
  paginationQuerySchema,
  emailSchema,
  passwordSchema,
  urlSchema,
  monitorStatusSchema,
  httpMonitorConfigSchema,
  maintenanceWindowSchema,
  withPagination,
} from './validation-schemas.js';
import { z } from 'zod';

describe('Validation Schemas', () => {
  describe('paginationQuerySchema', () => {
    it('should accept valid pagination parameters', () => {
      const result = paginationQuerySchema.parse({
        page: 2,
        limit: 50,
      });

      expect(result.page).toBe(2);
      expect(result.limit).toBe(50);
    });

    it('should use default values', () => {
      const result = paginationQuerySchema.parse({});

      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('should coerce string to number', () => {
      const result = paginationQuerySchema.parse({
        page: '3',
        limit: '25',
      });

      expect(result.page).toBe(3);
      expect(result.limit).toBe(25);
    });

    it('should reject negative page numbers', () => {
      expect(() =>
        paginationQuerySchema.parse({ page: -1 })
      ).toThrow();
    });

    it('should reject limit exceeding maximum', () => {
      expect(() =>
        paginationQuerySchema.parse({ limit: 200 })
      ).toThrow();
    });

    it('should accept cursor parameter', () => {
      const result = paginationQuerySchema.parse({ cursor: 'abc123' });

      expect(result.cursor).toBe('abc123');
    });
  });

  describe('emailSchema', () => {
    it('should accept valid email', () => {
      const result = emailSchema.parse('test@example.com');
      expect(result).toBe('test@example.com');
    });

    it('should lowercase email', () => {
      const result = emailSchema.parse('TEST@EXAMPLE.COM');
      expect(result).toBe('test@example.com');
    });

    it('should reject invalid email', () => {
      expect(() => emailSchema.parse('not-an-email')).toThrow();
    });
  });

  describe('passwordSchema', () => {
    it('should accept valid password', () => {
      const result = passwordSchema.parse('password123');
      expect(result).toBe('password123');
    });

    it('should reject password too short', () => {
      expect(() => passwordSchema.parse('short')).toThrow();
    });

    it('should reject password too long', () => {
      const longPassword = 'a'.repeat(130);
      expect(() => passwordSchema.parse(longPassword)).toThrow();
    });
  });

  describe('urlSchema', () => {
    it('should accept valid HTTP URL', () => {
      const result = urlSchema.parse('http://example.com');
      expect(result).toBe('http://example.com');
    });

    it('should accept valid HTTPS URL', () => {
      const result = urlSchema.parse('https://example.com/path');
      expect(result).toBe('https://example.com/path');
    });

    it('should reject invalid URL', () => {
      expect(() => urlSchema.parse('not-a-url')).toThrow();
    });
  });

  describe('monitorStatusSchema', () => {
    it('should accept valid statuses', () => {
      expect(monitorStatusSchema.parse('up')).toBe('up');
      expect(monitorStatusSchema.parse('down')).toBe('down');
      expect(monitorStatusSchema.parse('degraded')).toBe('degraded');
      expect(monitorStatusSchema.parse('unknown')).toBe('unknown');
    });

    it('should reject invalid status', () => {
      expect(() => monitorStatusSchema.parse('invalid')).toThrow();
    });
  });

  describe('httpMonitorConfigSchema', () => {
    it('should accept valid HTTP monitor config', () => {
      const result = httpMonitorConfigSchema.parse({
        url: 'https://example.com',
        method: 'GET',
        expectedStatusCode: 200,
      });

      expect(result.url).toBe('https://example.com');
      expect(result.method).toBe('GET');
      expect(result.expectedStatusCode).toBe(200);
    });

    it('should use defaults', () => {
      const result = httpMonitorConfigSchema.parse({
        url: 'https://example.com',
      });

      expect(result.method).toBe('GET');
      expect(result.expectedStatusCode).toBe(200);
      expect(result.followRedirects).toBe(true);
      expect(result.validateSSL).toBe(true);
    });

    it('should reject invalid URL', () => {
      expect(() =>
        httpMonitorConfigSchema.parse({ url: 'not-a-url' })
      ).toThrow();
    });

    it('should reject invalid method', () => {
      expect(() =>
        httpMonitorConfigSchema.parse({
          url: 'https://example.com',
          method: 'INVALID',
        })
      ).toThrow();
    });

    it('should accept custom headers', () => {
      const result = httpMonitorConfigSchema.parse({
        url: 'https://example.com',
        headers: {
          Authorization: 'Bearer token',
          'X-Custom': 'value',
        },
      });

      expect(result.headers).toEqual({
        Authorization: 'Bearer token',
        'X-Custom': 'value',
      });
    });
  });

  describe('maintenanceWindowSchema', () => {
    it('should accept valid maintenance window', () => {
      const now = new Date();
      const later = new Date(now.getTime() + 3600000); // 1 hour later

      const result = maintenanceWindowSchema.parse({
        name: 'Scheduled Maintenance',
        startsAt: now,
        endsAt: later,
        monitorIds: ['monitor-1', 'monitor-2'],
      });

      expect(result.name).toBe('Scheduled Maintenance');
      expect(result.monitorIds).toHaveLength(2);
    });

    it('should reject end date before start date', () => {
      const now = new Date();
      const earlier = new Date(now.getTime() - 3600000);

      expect(() =>
        maintenanceWindowSchema.parse({
          name: 'Invalid Window',
          startsAt: now,
          endsAt: earlier,
          monitorIds: ['monitor-1'],
        })
      ).toThrow();
    });

    it('should reject empty monitor IDs', () => {
      const now = new Date();
      const later = new Date(now.getTime() + 3600000);

      expect(() =>
        maintenanceWindowSchema.parse({
          name: 'No Monitors',
          startsAt: now,
          endsAt: later,
          monitorIds: [],
        })
      ).toThrow();
    });

    it('should accept optional description', () => {
      const now = new Date();
      const later = new Date(now.getTime() + 3600000);

      const result = maintenanceWindowSchema.parse({
        name: 'Scheduled Maintenance',
        startsAt: now,
        endsAt: later,
        monitorIds: ['monitor-1'],
        description: 'System upgrade',
      });

      expect(result.description).toBe('System upgrade');
    });
  });

  describe('withPagination helper', () => {
    it('should combine schema with pagination', () => {
      const customSchema = z.object({
        status: z.string(),
      });

      const combined = withPagination(customSchema);

      const result = combined.parse({
        status: 'active',
        page: 2,
        limit: 50,
      });

      expect(result.status).toBe('active');
      expect(result.page).toBe(2);
      expect(result.limit).toBe(50);
    });

    it('should use pagination defaults', () => {
      const customSchema = z.object({
        status: z.string(),
      });

      const combined = withPagination(customSchema);

      const result = combined.parse({
        status: 'active',
      });

      expect(result.status).toBe('active');
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });
  });
});

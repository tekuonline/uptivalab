/**
 * Unit tests for pagination utilities
 */

import { describe, it, expect } from 'vitest';
import {
  parsePaginationParams,
  getPaginationParams,
  getOffset,
  buildPaginationMeta,
  buildPaginatedResponse,
  formatCursorResponse,
  PAGINATION_DEFAULTS,
  type PaginationQuery,
} from './pagination.js';

describe('Pagination Utilities', () => {
  describe('parsePaginationParams', () => {
    it('should parse valid pagination parameters', () => {
      const query: PaginationQuery = { page: '2', limit: '50' };
      const result = parsePaginationParams(query);
      
      expect(result.page).toBe(2);
      expect(result.limit).toBe(50);
    });

    it('should use defaults when no params provided', () => {
      const query: PaginationQuery = {};
      const result = parsePaginationParams(query);
      
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('should enforce minimum page of 1', () => {
      const query: PaginationQuery = { page: '0' };
      const result = parsePaginationParams(query);
      
      expect(result.page).toBe(1);
    });

    it('should enforce maximum limit of 100', () => {
      const query: PaginationQuery = { limit: '200' };
      const result = parsePaginationParams(query);
      
      expect(result.limit).toBe(100);
    });

    it('should enforce minimum limit of 1', () => {
      const query: PaginationQuery = { limit: '0' };
      const result = parsePaginationParams(query);
      
      expect(result.limit).toBe(1);
    });

    it('should handle numeric values', () => {
      const query: PaginationQuery = { page: 3, limit: 25 };
      const result = parsePaginationParams(query);
      
      expect(result.page).toBe(3);
      expect(result.limit).toBe(25);
    });
  });

  describe('getPaginationParams', () => {
    it('should parse pagination with custom defaults', () => {
      const query: PaginationQuery = {};
      const result = getPaginationParams(query, { defaultLimit: 30, maxLimit: 50 });
      
      expect(result.page).toBe(1);
      expect(result.limit).toBe(30);
    });

    it('should enforce custom max limit', () => {
      const query: PaginationQuery = { limit: '100' };
      const result = getPaginationParams(query, { maxLimit: 50 });
      
      expect(result.limit).toBe(50);
    });

    it('should parse cursor parameter', () => {
      const query: PaginationQuery = { cursor: 'abc123' };
      const result = getPaginationParams(query);
      
      expect(result.cursor).toBe('abc123');
    });

    it('should handle undefined cursor', () => {
      const query: PaginationQuery = {};
      const result = getPaginationParams(query);
      
      expect(result.cursor).toBeUndefined();
    });
  });

  describe('getOffset', () => {
    it('should calculate offset for page 1', () => {
      expect(getOffset(1, 20)).toBe(0);
    });

    it('should calculate offset for page 2', () => {
      expect(getOffset(2, 20)).toBe(20);
    });

    it('should calculate offset for page 5 with limit 15', () => {
      expect(getOffset(5, 15)).toBe(60);
    });
  });

  describe('buildPaginationMeta', () => {
    it('should build correct metadata for first page', () => {
      const meta = buildPaginationMeta(100, 1, 20);
      
      expect(meta.currentPage).toBe(1);
      expect(meta.pageSize).toBe(20);
      expect(meta.totalCount).toBe(100);
      expect(meta.totalPages).toBe(5);
      expect(meta.hasNextPage).toBe(true);
      expect(meta.hasPreviousPage).toBe(false);
    });

    it('should build correct metadata for middle page', () => {
      const meta = buildPaginationMeta(100, 3, 20);
      
      expect(meta.currentPage).toBe(3);
      expect(meta.hasNextPage).toBe(true);
      expect(meta.hasPreviousPage).toBe(true);
    });

    it('should build correct metadata for last page', () => {
      const meta = buildPaginationMeta(100, 5, 20);
      
      expect(meta.currentPage).toBe(5);
      expect(meta.hasNextPage).toBe(false);
      expect(meta.hasPreviousPage).toBe(true);
    });

    it('should handle partial last page', () => {
      const meta = buildPaginationMeta(95, 5, 20);
      
      expect(meta.totalPages).toBe(5);
      expect(meta.hasNextPage).toBe(false);
    });

    it('should handle empty results', () => {
      const meta = buildPaginationMeta(0, 1, 20);
      
      expect(meta.totalCount).toBe(0);
      expect(meta.totalPages).toBe(0);
      expect(meta.hasNextPage).toBe(false);
      expect(meta.hasPreviousPage).toBe(false);
    });
  });

  describe('buildPaginatedResponse', () => {
    const sampleData = [
      { id: '1', name: 'Item 1' },
      { id: '2', name: 'Item 2' },
    ];

    it('should build response with object options (new signature)', () => {
      const response = buildPaginatedResponse(sampleData, {
        page: 2,
        limit: 10,
        total: 25,
      });
      
      expect(response.data).toEqual(sampleData);
      expect(response.meta.currentPage).toBe(2);
      expect(response.meta.pageSize).toBe(10);
      expect(response.meta.totalCount).toBe(25);
      expect(response.meta.totalPages).toBe(3);
    });

    it('should build response with positional args (old signature)', () => {
      const response = buildPaginatedResponse(sampleData, 25, 2, 10);
      
      expect(response.data).toEqual(sampleData);
      expect(response.meta.currentPage).toBe(2);
      expect(response.meta.pageSize).toBe(10);
      expect(response.meta.totalCount).toBe(25);
    });

    it('should use defaults when not provided', () => {
      const response = buildPaginatedResponse(sampleData, {});
      
      expect(response.meta.currentPage).toBe(1);
      expect(response.meta.pageSize).toBe(20);
      expect(response.meta.totalCount).toBe(0);
    });
  });

  describe('formatCursorResponse', () => {
    const items = [
      { id: '1', name: 'Item 1' },
      { id: '2', name: 'Item 2' },
      { id: '3', name: 'Item 3' },
    ];

    it('should return all items when no more pages', () => {
      const result = formatCursorResponse(items, 5);
      
      expect(result.items).toHaveLength(3);
      expect(result.nextCursor).toBeNull();
    });

    it('should slice items and return cursor when more pages exist', () => {
      const result = formatCursorResponse(items, 2);
      
      expect(result.items).toHaveLength(2);
      expect(result.nextCursor).toBe('2');
    });

    it('should handle exactly matching requested limit', () => {
      const result = formatCursorResponse(items, 3);
      
      expect(result.items).toHaveLength(3);
      expect(result.nextCursor).toBeNull();
    });

    it('should handle empty items array', () => {
      const result = formatCursorResponse([], 10);
      
      expect(result.items).toHaveLength(0);
      expect(result.nextCursor).toBeNull();
    });
  });

  describe('PAGINATION_DEFAULTS', () => {
    it('should have sensible defaults', () => {
      expect(PAGINATION_DEFAULTS.DEFAULT).toBe(20);
      expect(PAGINATION_DEFAULTS.MAX).toBe(100);
      expect(PAGINATION_DEFAULTS.MONITOR_LIST).toBeGreaterThan(0);
      expect(PAGINATION_DEFAULTS.INCIDENTS).toBeGreaterThan(0);
    });

    it('should have MAX greater than or equal to all other limits', () => {
      const values = Object.values(PAGINATION_DEFAULTS);
      const max = Math.max(...values);
      
      expect(PAGINATION_DEFAULTS.MAX).toBeGreaterThanOrEqual(max);
    });
  });
});

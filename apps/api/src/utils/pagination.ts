/**
 * Pagination utilities for API responses
 * Implements cursor-based and offset-based pagination for optimal performance
 */

export interface PaginationParams {
  page?: number;
  limit?: number;
  cursor?: string;
  sort?: string;
}

export interface PaginationMeta {
  currentPage: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

/**
 * Parse and validate pagination parameters with sensible defaults
 */
export function parsePaginationParams(query: any): {
  page: number;
  limit: number;
} {
  const page = Math.max(1, parseInt(query.page || '1'));
  const limit = Math.min(100, Math.max(1, parseInt(query.limit || '20'))); // Cap at 100 for performance

  return { page, limit };
}

/**
 * Get pagination parameters with custom defaults (NEW)
 */
export function getPaginationParams(
  query: any, 
  options: { defaultLimit?: number; maxLimit?: number } = {}
): { page: number; limit: number; cursor?: string } {
  const defaultLimit = options.defaultLimit || 20;
  const maxLimit = options.maxLimit || 100;

  const page = Math.max(1, parseInt(query.page || '1'));
  const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit || defaultLimit.toString())));
  const cursor = query.cursor as string | undefined;

  return { page, limit, cursor };
}

/**
 * Calculate offset for database query
 */
export function getOffset(page: number, limit: number): number {
  return (page - 1) * limit;
}

/**
 * Build pagination metadata
 */
export function buildPaginationMeta(
  totalCount: number,
  page: number,
  limit: number
): PaginationMeta {
  const totalPages = Math.ceil(totalCount / limit);

  return {
    currentPage: page,
    pageSize: limit,
    totalCount,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}

/**
 * Build paginated response (original signature)
 */
export function buildPaginatedResponse<T>(
  data: T[],
  options: { page?: number; limit?: number; total?: number } | number,
  pageOrLimit?: number,
  limit?: number
): PaginatedResponse<T> {
  // Handle both old and new signatures for backwards compatibility
  let resolvedPage: number;
  let resolvedLimit: number;
  let resolvedTotal: number;

  if (typeof options === 'object') {
    // New signature: buildPaginatedResponse(data, { page, limit, total })
    resolvedPage = options.page || 1;
    resolvedLimit = options.limit || 20;
    resolvedTotal = options.total || 0;
  } else {
    // Old signature: buildPaginatedResponse(data, totalCount, page, limit)
    resolvedTotal = options;
    resolvedPage = pageOrLimit || 1;
    resolvedLimit = limit || 20;
  }

  return {
    data,
    meta: buildPaginationMeta(resolvedTotal, resolvedPage, resolvedLimit),
  };
}

/**
 * Cursor-based pagination (for real-time data, more efficient for large datasets)
 * 
 * Usage:
 * const { items, nextCursor } = await getCursorPage(prisma, Model, {
 *   cursor: undefined,
 *   limit: 20,
 *   orderBy: { createdAt: 'desc' }
 * });
 */
export function getCursorPageQuery<T>(
  cursor: string | undefined,
  limit: number,
  orderBy: any
) {
  const queryLimit = Math.min(limit + 1, 100); // Fetch one extra to detect if there's a next page

  if (!cursor) {
    return {
      take: queryLimit,
      skip: 0,
      orderBy,
    };
  }

  return {
    take: queryLimit,
    skip: 1, // Skip the cursor
    cursor: { id: cursor },
    orderBy,
  };
}

/**
 * Format cursor response for pagination
 */
export function formatCursorResponse<T extends { id: string }>(
  items: T[],
  requestedLimit: number
): { items: T[]; nextCursor: string | null } {
  const hasMore = items.length > requestedLimit;

  if (hasMore) {
    const returnedItems = items.slice(0, requestedLimit);
    const nextCursor = returnedItems[returnedItems.length - 1]?.id || null;
    return {
      items: returnedItems,
      nextCursor,
    };
  }

  return {
    items,
    nextCursor: null,
  };
}

/**
 * Recommended pagination sizes for different data types
 */
export const PAGINATION_DEFAULTS = {
  MONITOR_LIST: 20,      // Light payload, can be higher
  INCIDENTS: 15,         // Medium payload
  CHECK_RESULTS: 50,     // Small individual items
  USERS: 25,
  NOTIFICATIONS: 30,
  MAINTENANCE_WINDOWS: 20,
  DEFAULT: 20,
  MAX: 100,              // Hard cap to prevent abuse
};

/**
 * Simple in-memory query cache for frequently accessed data
 * TTL-based automatic invalidation
 */

interface CacheEntry<T> {
  data: T;
  expiry: number;
}

class QueryCache {
  private cache = new Map<string, CacheEntry<any>>();
  private DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Get cached value if exists and not expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Set cache value with TTL
   */
  set<T>(key: string, data: T, ttlMs = this.DEFAULT_TTL): void {
    this.cache.set(key, {
      data,
      expiry: Date.now() + ttlMs,
    });
  }

  /**
   * Clear specific cache key
   */
  invalidate(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear all cache entries matching pattern
   */
  invalidatePattern(pattern: string): void {
    const regex = new RegExp(pattern);
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache stats
   */
  stats() {
    return {
      entries: this.cache.size,
      memoryUsageBytes: JSON.stringify(Array.from(this.cache.entries())).length,
    };
  }
}

export const queryCache = new QueryCache();

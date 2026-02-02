import { log } from "../utils/logger.js";

/**
 * Advanced caching strategies for top-notch performance
 * Includes multi-tier caching with TTL, event invalidation, and memory management
 */

interface CacheOptions {
  ttl?: number;
  maxSize?: number; // Max entries in cache
  onEvict?: (key: string, value: any) => void;
}

interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  hitRate: number;
}

interface CacheEntry<T> {
  data: T;
  expiry: number;
  hits: number;
  lastAccess: number;
}

export class AdvancedCache<T = any> {
  private cache = new Map<string, CacheEntry<T>>();
  private stats = {
    hits: 0,
    misses: 0,
  };
  private readonly maxSize: number;
  private readonly defaultTtl: number;
  private readonly onEvict: ((key: string, value: T) => void) | undefined;

  constructor(options: CacheOptions = {}) {
    this.maxSize = options.maxSize || 1000;
    this.defaultTtl = options.ttl || 5 * 60 * 1000; // 5 minutes default
    this.onEvict = options.onEvict;

    // Cleanup expired entries every minute
    setInterval(() => this.cleanup(), 60 * 1000);
  }

  /**
   * Get cached value with hit tracking
   */
  get(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check expiration
    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    // Update access tracking
    entry.hits++;
    entry.lastAccess = Date.now();
    this.stats.hits++;

    return entry.data;
  }

  /**
   * Set cache value with automatic expiration
   */
  set(key: string, data: T, ttlMs = this.defaultTtl): void {
    // Evict LRU entry if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    this.cache.set(key, {
      data,
      expiry: Date.now() + ttlMs,
      hits: 0,
      lastAccess: Date.now(),
    });
  }

  /**
   * Invalidate specific key
   */
  invalidate(key: string): void {
    const entry = this.cache.get(key);
    if (entry) {
      this.onEvict?.(key, entry.data);
    }
    this.cache.delete(key);
  }

  /**
   * Invalidate by pattern (regex)
   */
  invalidatePattern(pattern: string | RegExp): number {
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
    let count = 0;

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.invalidate(key);
        count++;
      }
    }

    return count;
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.cache.forEach((entry, key) => {
      this.onEvict?.(key, entry.data);
    });
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const totalRequests = this.stats.hits + this.stats.misses;
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      size: this.cache.size,
      hitRate: totalRequests === 0 ? 0 : (this.stats.hits / totalRequests) * 100,
    };
  }

  /**
   * Remove expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiry) {
        this.invalidate(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      log.info(`🧹 Cache cleanup: removed ${cleanedCount} expired entries`);
    }
  }

  /**
   * Evict Least Recently Used entry
   */
  private evictLRU(): void {
    let lruKey: string | null = null;
    let lruTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccess < lruTime) {
        lruTime = entry.lastAccess;
        lruKey = key;
      }
    }

    if (lruKey) {
      log.info(`📦 Cache eviction: LRU key "${lruKey}" removed`);
      this.invalidate(lruKey);
    }
  }
}

/**
 * Predefined cache instances for different data types
 */
export const caches = {
  monitors: new AdvancedCache<any>({
    ttl: 5 * 60 * 1000, // 5 minutes
    maxSize: 500,
  }),
  incidents: new AdvancedCache<any>({
    ttl: 3 * 60 * 1000, // 3 minutes - more volatile
    maxSize: 1000,
  }),
  userSettings: new AdvancedCache<any>({
    ttl: 30 * 60 * 1000, // 30 minutes - rarely changes
    maxSize: 200,
  }),
  statusPages: new AdvancedCache<any>({
    ttl: 2 * 60 * 1000, // 2 minutes - frequently accessed
    maxSize: 300,
  }),
  notificationChannels: new AdvancedCache<any>({
    ttl: 5 * 60 * 1000, // 5 minutes
    maxSize: 150,
  }),
  maintenanceWindows: new AdvancedCache<any>({
    ttl: 5 * 60 * 1000, // 5 minutes
    maxSize: 200,
  }),
};

/**
 * Advanced cache facade for easy access to per-entity caches
 */
export class AdvancedCacheFacade {
  private caches: Record<string, AdvancedCache<any>> = {
    monitors: caches.monitors,
    incidents: caches.incidents,
    userSettings: caches.userSettings,
    statusPages: caches.statusPages,
    notificationChannels: caches.notificationChannels,
    maintenanceWindows: caches.maintenanceWindows,
  };

  /**
   * Get value from entity cache
   */
  get(entity: string, key: string): any | null {
    const cache = this.caches[entity];
    if (!cache) return null;
    return cache.get(key);
  }

  /**
   * Set value in entity cache
   */
  set(entity: string, key: string, value: any, ttl?: number): void {
    const cache = this.caches[entity];
    if (cache) {
      cache.set(key, value, ttl);
    }
  }

  /**
   * Clear entity cache
   */
  clear(entity: string): void {
    const cache = this.caches[entity];
    if (cache) {
      cache.clear();
    }
  }

  /**
   * Warm cache by running async function and storing result
   */
  async warm(entity: string, fn: () => Promise<any>): Promise<void> {
    try {
      const cache = this.caches[entity];
      if (cache) {
        const data = await fn();
        const key = `warm:${Date.now()}`;
        cache.set(key, data);
      }
    } catch (error) {
      log.error(`Cache warming failed for entity ${entity}:`, error);
    }
  }

  /**
   * Get stats for all caches
   */
  getStats(): Record<string, any> {
    const stats: Record<string, any> = {};
    Object.entries(this.caches).forEach(([name, cache]) => {
      stats[name] = cache.getStats();
    });
    return stats;
  }
}

// Export singleton instance
export const advancedCache = new AdvancedCacheFacade();

/**
 * Cache warming strategy - preload common queries
 */
export async function warmCache(prisma: any, userId: string) {
  const startTime = Date.now();

  try {
    // Preload user's monitors
    const monitors = await prisma.monitor.findMany({
      where: { userId },
      select: { id: true, name: true, status: true },
    });
    caches.monitors.set(`user:${userId}:monitors`, monitors, 5 * 60 * 1000);

    // Preload recent incidents
    const incidents = await prisma.incident.findMany({
      where: { monitor: { userId } },
      take: 50,
      orderBy: { startedAt: 'desc' },
    });
    caches.incidents.set(`user:${userId}:incidents`, incidents, 3 * 60 * 1000);

    const duration = Date.now() - startTime;
    log.info(`✨ Cache warmed for user ${userId} in ${duration}ms`);
  } catch (error) {
    log.error('Error warming cache:', error);
  }
}

/**
 * Cache invalidation helper
 */
export function invalidateUserCache(userId: string) {
  // Invalidate all user-related caches
  caches.monitors.invalidatePattern(`user:${userId}:.*`);
  caches.incidents.invalidatePattern(`user:${userId}:.*`);
  caches.userSettings.invalidate(`user:${userId}:settings`);
  caches.statusPages.invalidatePattern(`user:${userId}:.*`);
}

/**
 * Log all cache statistics for monitoring
 */
export function logCacheStats() {
  const stats = {
    monitors: caches.monitors.getStats(),
    incidents: caches.incidents.getStats(),
    userSettings: caches.userSettings.getStats(),
    statusPages: caches.statusPages.getStats(),
  };

  log.info('📊 CACHE STATISTICS');
  Object.entries(stats).forEach(([name, stat]) => {
    log.info(
      `  ${name}: ${stat.hits} hits, ${stat.misses} misses, ${stat.hitRate.toFixed(1)}% hit rate, ${stat.size} entries`
    );
  });

  return stats;
}

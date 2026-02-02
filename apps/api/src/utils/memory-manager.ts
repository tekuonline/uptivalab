import { log } from "../utils/logger.js";

/**
 * Memory management utilities for performance monitoring
 * Tracks heap usage, event listeners, and provides cleanup capabilities
 */

interface MemoryMetrics {
  heapUsedMb: number;
  heapTotalMb: number;
  externalMb: number;
  rsseMb: number;
  percentUsed: number;
}

interface HealthStatus {
  healthy: boolean;
  warnings: string[];
  metrics: MemoryMetrics;
}

class MemoryManager {
  private listenerCounts = new Map<string, number>();
  private HEAP_WARNING_THRESHOLD = 200; // MB
  private HEAP_CRITICAL_THRESHOLD = 300; // MB
  private LISTENER_WARNING_THRESHOLD = 1000;

  /**
   * Get current memory metrics
   */
  getMetrics(): MemoryMetrics {
    if (!process.memoryUsage) {
      return {
        heapUsedMb: 0,
        heapTotalMb: 0,
        externalMb: 0,
        rsseMb: 0,
        percentUsed: 0,
      };
    }

    const usage = process.memoryUsage();
    const heapUsedMb = Math.round(usage.heapUsed / 1024 / 1024);
    const heapTotalMb = Math.round(usage.heapTotal / 1024 / 1024);
    const externalMb = Math.round(usage.external / 1024 / 1024);
    const rsseMb = Math.round(usage.rss / 1024 / 1024);

    return {
      heapUsedMb,
      heapTotalMb,
      externalMb,
      rsseMb,
      percentUsed: Math.round((heapUsedMb / heapTotalMb) * 100),
    };
  }

  /**
   * Check system health and return warnings
   */
  getHealth(): HealthStatus {
    const metrics = this.getMetrics();
    const warnings: string[] = [];

    if (metrics.heapUsedMb > this.HEAP_CRITICAL_THRESHOLD) {
      warnings.push(`🔴 CRITICAL: Heap usage ${metrics.heapUsedMb}MB exceeds ${this.HEAP_CRITICAL_THRESHOLD}MB`);
    } else if (metrics.heapUsedMb > this.HEAP_WARNING_THRESHOLD) {
      warnings.push(`⚠️  WARNING: Heap usage ${metrics.heapUsedMb}MB exceeds ${this.HEAP_WARNING_THRESHOLD}MB`);
    }

    // Check listener counts
    for (const [name, count] of this.listenerCounts) {
      if (count > this.LISTENER_WARNING_THRESHOLD) {
        warnings.push(`⚠️  WARNING: ${name} has ${count} listeners (threshold: ${this.LISTENER_WARNING_THRESHOLD})`);
      }
    }

    return {
      healthy: warnings.length === 0,
      warnings,
      metrics,
    };
  }

  /**
   * Track event listener creation
   */
  trackListener(name: string): void {
    this.listenerCounts.set(name, (this.listenerCounts.get(name) || 0) + 1);
  }

  /**
   * Track event listener removal
   */
  untrackListener(name: string): void {
    const current = this.listenerCounts.get(name) || 0;
    if (current > 0) {
      this.listenerCounts.set(name, current - 1);
    }
  }

  /**
   * Reset listener counts
   */
  resetListeners(): void {
    this.listenerCounts.clear();
  }

  /**
   * Force garbage collection (if available)
   */
  forceGarbageCollection(): void {
    if (global.gc) {
      global.gc();
    } else {
      log.warn('Garbage collection not available. Run Node with --expose-gc flag.');
    }
  }

  /**
   * Log memory report
   */
  logReport(): void {
    const health = this.getHealth();
    log.info('\n📊 MEMORY REPORT');
    log.info(`📈 Heap: ${health.metrics.heapUsedMb}MB / ${health.metrics.heapTotalMb}MB (${health.metrics.percentUsed}%)`);
    log.info(`💾 RSS: ${health.metrics.rsseMb}MB`);
    log.info(`🔗 Listeners: ${this.listenerCounts.size} types tracked`);

    if (health.warnings.length > 0) {
      log.info('⚠️  Warnings:');
      health.warnings.forEach(w => log.info(`   ${w}`));
    }
    log.info('');
  }
}

export const memoryManager = new MemoryManager();

/**
 * Start periodic memory monitoring
 */
export function startMemoryMonitoring(intervalMs = 60000): NodeJS.Timeout {
  return setInterval(() => {
    const health = memoryManager.getHealth();
    if (!health.healthy) {
      log.warn('⚠️  Memory health check failed:', health.warnings);
    }
  }, intervalMs);
}

import { prisma } from "../db/prisma.js";
import { log } from "../utils/logger.js";

/**
 * Database Cleanup Service
 *
 * Manages automatic retention and cleanup of monitor check results and screenshots.
 * This prevents database bloat from accumulating historical data while maintaining
 * sufficient data for trend analysis and debugging.
 *
 * Retention Strategy:
 * - Successful checks: 60 days (supports 2-month trend analysis)
 * - Failed checks: 90 days (longer retention for debugging and investigation)
 * - Screenshots: 60 days (aligned with successful checks, prevents screenshot bloat)
 * - Max checks per monitor: 2000 (prevents single monitor from dominating database)
 *
 * Storage Impact (approximate):
 * - Without cleanup: ~10MB per monitor per month (with screenshots)
 * - With cleanup: ~600MB per 100 monitors maintained
 *
 * The service runs daily and deletes old data in this order:
 * 1. Screenshots older than keepScreenshotsDays
 * 2. Successful checks older than keepSuccessfulChecksDays
 * 3. Failed checks older than keepFailedChecksDays
 * 4. Excess checks per monitor (keeps only maxChecksPerMonitor)
 */

export interface CleanupConfig {
  // Keep successful checks for this many days
  keepSuccessfulChecksDays: number;
  // Keep failed checks for this many days
  keepFailedChecksDays: number;
  // Keep screenshots for this many days (regardless of check status)
  keepScreenshotsDays: number;
  // Maximum number of checks to keep per monitor
  maxChecksPerMonitor: number;
  // Run cleanup every N hours
  cleanupIntervalHours: number;
}

const DEFAULT_CONFIG: CleanupConfig = {
  keepSuccessfulChecksDays: 60, // Keep successful checks for 60 days (better for trend analysis)
  keepFailedChecksDays: 90,     // Keep failed checks for 90 days (longer retention for debugging)
  keepScreenshotsDays: 60,      // Keep screenshots for 60 days (aligned with successful checks)
  maxChecksPerMonitor: 2000,    // Keep max 2000 checks per monitor (~2 weeks at 1min intervals, ~1 month at 5min)
  cleanupIntervalHours: 24,     // Run cleanup daily
};

export class DatabaseCleanupService {
  private config: CleanupConfig;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config: Partial<CleanupConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Start the automatic cleanup scheduler
   */
  start() {
    log.info(`[Database Cleanup] Starting cleanup service with interval: ${this.config.cleanupIntervalHours} hours`);

    // Run initial cleanup
    this.runCleanup().catch(error => {
      log.error("[Database Cleanup] Initial cleanup failed:", { error });
    });

    // Schedule recurring cleanup
    this.cleanupInterval = setInterval(() => {
      this.runCleanup().catch(error => {
        log.error("[Database Cleanup] Scheduled cleanup failed:", { error });
      });
    }, this.config.cleanupIntervalHours * 60 * 60 * 1000);
  }

  /**
   * Stop the automatic cleanup scheduler
   */
  stop() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      log.info("[Database Cleanup] Cleanup service stopped");
    }
  }

  /**
   * Run a manual cleanup
   */
  async runCleanup(): Promise<{
    deletedChecks: number;
    deletedScreenshots: number;
    errors: string[];
  }> {
    const startTime = Date.now();
    const errors: string[] = [];
    let deletedChecks = 0;
    let deletedScreenshots = 0;

    log.info("[Database Cleanup] Starting cleanup process...");

    try {
      // Calculate cutoff dates
      const successfulCutoff = new Date();
      successfulCutoff.setDate(successfulCutoff.getDate() - this.config.keepSuccessfulChecksDays);

      const failedCutoff = new Date();
      failedCutoff.setDate(failedCutoff.getDate() - this.config.keepFailedChecksDays);

      const screenshotCutoff = new Date();
      screenshotCutoff.setDate(screenshotCutoff.getDate() - this.config.keepScreenshotsDays);

      // 1. Delete old screenshots (regardless of check status)
      const deletedScreenshotResult = await prisma.checkScreenshot.deleteMany({
        where: {
          capturedAt: {
            lt: screenshotCutoff,
          },
        },
      });
      deletedScreenshots += deletedScreenshotResult.count;
      log.info(`[Database Cleanup] Deleted ${deletedScreenshotResult.count} old screenshots`);

      // 2. Delete old successful checks
      const deletedSuccessfulChecks = await prisma.checkResult.deleteMany({
        where: {
          status: "up",
          checkedAt: {
            lt: successfulCutoff,
          },
        },
      });
      deletedChecks += deletedSuccessfulChecks.count;
      log.info(`[Database Cleanup] Deleted ${deletedSuccessfulChecks.count} old successful checks`);

      // 3. Delete old failed checks (but keep more of them)
      const deletedFailedChecks = await prisma.checkResult.deleteMany({
        where: {
          status: { not: "up" },
          checkedAt: {
            lt: failedCutoff,
          },
        },
      });
      deletedChecks += deletedFailedChecks.count;
      log.info(`[Database Cleanup] Deleted ${deletedFailedChecks.count} old failed checks`);

      // 4. Enforce maximum checks per monitor (keep most recent)
      const monitors = await prisma.monitor.findMany({
        select: { id: true, name: true },
      });

      for (const monitor of monitors) {
        const checkCount = await prisma.checkResult.count({
          where: { monitorId: monitor.id },
        });

        if (checkCount > this.config.maxChecksPerMonitor) {
          const excessCount = checkCount - this.config.maxChecksPerMonitor;

          // Get the IDs of oldest checks to delete
          const oldestChecks = await prisma.checkResult.findMany({
            where: { monitorId: monitor.id },
            orderBy: { checkedAt: "asc" },
            take: excessCount,
            select: { id: true },
          });

          const checkIdsToDelete = oldestChecks.map(check => check.id);

          // Delete the excess checks
          const deletedExcess = await prisma.checkResult.deleteMany({
            where: { id: { in: checkIdsToDelete } },
          });

          deletedChecks += deletedExcess.count;
          log.info(`[Database Cleanup] Deleted ${deletedExcess.count} excess checks for monitor ${monitor.name}`);
        }
      }

      // 5. Clean up orphaned screenshots (screenshots without check results)
      // Note: This is a complex query that requires raw SQL in some databases
      // For now, we'll skip this check as it's not critical
      const orphanedScreenshots = { count: 0 };

      if (orphanedScreenshots.count > 0) {
        deletedScreenshots += orphanedScreenshots.count;
        log.info(`[Database Cleanup] Deleted ${orphanedScreenshots.count} orphaned screenshots`);
      }

      const duration = Date.now() - startTime;
      log.info(`[Database Cleanup] Cleanup completed in ${duration}ms. Deleted ${deletedChecks} checks and ${deletedScreenshots} screenshots.`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log.error("[Database Cleanup] Cleanup failed:", { error: errorMessage });
      errors.push(errorMessage);
    }

    return { deletedChecks, deletedScreenshots, errors };
  }

  /**
   * Get cleanup statistics
   */
  async getStats(): Promise<{
    totalChecks: number;
    totalScreenshots: number;
    oldestCheck: Date | null;
    oldestScreenshot: Date | null;
    databaseSize: string | null;
  }> {
    try {
      const [checkStats, screenshotStats] = await Promise.all([
        prisma.checkResult.aggregate({
          _count: { id: true },
          _min: { checkedAt: true },
        }),
        prisma.checkScreenshot.aggregate({
          _count: { id: true },
          _min: { capturedAt: true },
        }),
      ]);

      // Try to get database size (PostgreSQL specific)
      let databaseSize: string | null = null;
      try {
        const sizeResult = await prisma.$queryRaw<{ pg_size_pretty: string }[]>`
          SELECT pg_size_pretty(pg_database_size(current_database())) as pg_size_pretty
        `;
        databaseSize = sizeResult[0]?.pg_size_pretty || null;
      } catch {
        // Ignore if not PostgreSQL or query fails
      }

      return {
        totalChecks: checkStats._count.id,
        totalScreenshots: screenshotStats._count.id,
        oldestCheck: checkStats._min.checkedAt,
        oldestScreenshot: screenshotStats._min.capturedAt,
        databaseSize,
      };
    } catch (error) {
      log.error("[Database Cleanup] Failed to get stats:", { error });
      throw error;
    }
  }
}

// Export singleton instance
export const databaseCleanupService = new DatabaseCleanupService();
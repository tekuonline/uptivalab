import { createServer } from "./server.js";
import { monitorOrchestrator, ensurePlaywrightBrowsersInstalled } from "./services/monitor-engine/orchestrator.js";
import { maintenanceScheduler } from "./services/maintenance/scheduler.js";
import { databaseCleanupService } from "./services/database-cleanup.js";
import { appConfig } from "./config.js";
import { log } from "./utils/logger.js";

/**
 * UptivaLab API Server Startup Sequence
 *
 * 1. Create Fastify server with plugins and error handlers
 * 2. PRE-INSTALL Playwright browsers (prevents race conditions in concurrent jobs)
 * 3. Bootstrap monitor orchestrator (starts scheduled monitor checks)
 * 4. Bootstrap maintenance scheduler (manages maintenance windows)
 * 5. Start database cleanup service (removes old data daily)
 * 6. Listen on configured port
 *
 * Each startup phase has independent error handling - failure in one phase
 * doesn't crash the server, allowing graceful degradation.
 */

const start = async () => {
  const server = await createServer();
  try {
    // PHASE 1: Pre-install Playwright browsers early to avoid race conditions in concurrent monitor jobs
    try {
      await ensurePlaywrightBrowsersInstalled();
      log.info("✅ Playwright browsers pre-installed successfully");
    } catch (error) {
      log.warn("⚠️ Failed to pre-install Playwright browsers, will attempt on-demand:", error);
      // Don't crash the server if browser pre-installation fails
      // Synthetic monitors with local browsers will attempt on-demand installation
    }

    // PHASE 2: Bootstrap monitors and maintenance scheduler with error handling
    try {
      await monitorOrchestrator.bootstrap();
      log.info("✅ Monitor orchestrator bootstrapped successfully");
    } catch (error) {
      log.error("❌ Failed to bootstrap monitor orchestrator:", error);
      // Don't crash the server if bootstrap fails
    }

    try {
      await maintenanceScheduler.bootstrap();
      log.info("✅ Maintenance scheduler bootstrapped successfully");
    } catch (error) {
      log.error("❌ Failed to bootstrap maintenance scheduler:", error);
      // Don't crash the server if bootstrap fails
    }

    // PHASE 3: Start database cleanup service
    try {
      databaseCleanupService.start();
      log.info("✅ Database cleanup service started successfully");
    } catch (error) {
      log.error("❌ Failed to start database cleanup service:", error);
      // Don't crash the server if cleanup service fails
    }

    // PHASE 4: Start listening on port
    await server.listen({ port: appConfig.PORT, host: "0.0.0.0" });
    server.log.info(`UptivaLab API listening on ${appConfig.PORT}`);
  } catch (error) {
    server.log.error(error, "Failed to start API server");
    process.exit(1);
  }
};

start();


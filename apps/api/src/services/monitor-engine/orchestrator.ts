import { Queue, Worker, type Job } from "bullmq";
import { Redis } from "ioredis";
import { prisma } from "../../db/prisma.js";
import { type Monitor } from "@prisma/client";
import { MonitorEngine, type MonitorResult } from "@uptivalab/monitoring";
import { appConfig } from "../../config.js";
import { settingsService } from "../settings/service.js";
import { maintenanceService } from "../maintenance/suppressor.js";
import { notificationRouter } from "../notifications/router.js";
import { incidentManager } from "../incidents/manager.js";
import { broadcastBus } from "../../realtime/events.js";
import { log } from "../../utils/logger.js";

const toConfigObject = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return { ...(value as Record<string, unknown>) };
  }
  return {};
};

const serializeJson = (value: unknown): any => {
  return value === undefined ? {} : JSON.parse(JSON.stringify(value));
};

/**
 * Playwright Browser Installation Strategy
 *
 * The ensurePlaywrightBrowsersInstalled() function is called:
 * 1. EARLY: During server startup in index.ts (pre-installation phase)
 * 2. FALLBACK: During synthetic monitor execution if pre-installation failed
 *
 * This two-phase approach prevents race conditions where multiple concurrent
 * synthetic monitor jobs would attempt simultaneous browser installation.
 *
 * Browser installation only happens once, subsequent calls return immediately
 * using the global `browsersInstalled` flag.
 */

// Global flag to prevent concurrent browser installations
let browserInstallationInProgress = false;
let browsersInstalled = false;

export const ensurePlaywrightBrowsersInstalled = async (): Promise<void> => {
  // If already installed, return immediately
  if (browsersInstalled) {
    return;
  }

  // If installation is in progress, wait for it to complete
  if (browserInstallationInProgress) {
    while (browserInstallationInProgress) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    return;
  }

  const fs = await import("fs");
  const path = await import("path");
  const { exec } = await import("child_process");
  const { promisify } = await import("util");
  const execAsync = promisify(exec);

  const playwrightBrowsersPath = process.env.PLAYWRIGHT_BROWSERS_PATH || "/ms-playwright";

  // Check if browsers are already installed - look for firefox directory
  const browsersExist = fs.existsSync(playwrightBrowsersPath) &&
    fs.readdirSync(playwrightBrowsersPath).some(file =>
      file.includes('firefox')
    );

  if (browsersExist) {
    browsersInstalled = true;
    return;
  }

  // Check system dependencies
  const systemDepsInstalled = fs.existsSync("/usr/lib/x86_64-linux-gnu/libnss3.so") ||
                              fs.existsSync("/usr/lib/aarch64-linux-gnu/libnss3.so");

  if (!systemDepsInstalled) {
    try {
      // Install system dependencies (these are already installed in Dockerfile, but just in case)
      await execAsync("apt-get update && apt-get install -y --no-install-recommends libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2");
    } catch (error) {
      throw new Error("Failed to install system dependencies for Playwright");
    }
  }

  // Install browsers
  browserInstallationInProgress = true;
  try {
    // Create browsers directory if it doesn't exist
    if (!fs.existsSync(playwrightBrowsersPath)) {
      fs.mkdirSync(playwrightBrowsersPath, { recursive: true });
    }

    // Install browsers using npx playwright install
    await execAsync(`npx playwright@1.57.0 install chromium firefox webkit --with-deps`, {
      env: {
        ...process.env,
        PLAYWRIGHT_BROWSERS_PATH: playwrightBrowsersPath
      },
      timeout: 300000 // 5 minutes timeout
    });

    browsersInstalled = true;
  } catch (error) {
    throw new Error("Failed to install Playwright browsers");
  } finally {
    browserInstallationInProgress = false;
  }
};

const connection = new Redis(appConfig.REDIS_URL, { maxRetriesPerRequest: null });

const queueName = "monitor-runner";
const monitorQueue = new Queue(queueName, { connection });

const monitorEngine = new MonitorEngine();

const worker = new Worker(
  queueName,
  async (job) => {
    const monitor = await prisma.monitor.findUnique({
      where: { id: job.data.monitorId },
      include: { heartbeats: true },
    });
    if (!monitor) return;
    const config = toConfigObject(monitor.config);
    
    // Inject global certificate expiry threshold for certificate monitors
    if (monitor.kind === "certificate") {
      const certExpiryThreshold = await settingsService.get<number>("certExpiryThresholdDays", 30);
      const certConfig = config as Record<string, unknown> & { warningDays?: number };
      // Use global setting if not set in monitor config
      if (certConfig.warningDays === undefined) {
        certConfig.warningDays = certExpiryThreshold;
      }
    }
    
    if (monitor.kind === "push" && monitor.heartbeats) {
      const pushConfig = config as Record<string, unknown> & {
        heartbeatSeconds?: number;
        lastHeartbeatAt?: string;
      };
      if (typeof pushConfig.heartbeatSeconds !== "number") {
        pushConfig.heartbeatSeconds = monitor.heartbeats.heartbeatEvery;
      }
      pushConfig.lastHeartbeatAt = monitor.heartbeats.lastHeartbeat?.toISOString() ?? undefined;
    }
    const suppressed = await maintenanceService.isSuppressed(monitor.id);

    // Note: Playwright browsers are now pre-installed at server startup to avoid race conditions
    // If pre-installation failed, it will be retried here as fallback for on-demand monitors
    if (monitor.kind === "synthetic" && config.useLocalBrowser === true && !browsersInstalled) {
      log.info(`[Monitor Orchestrator] Attempting on-demand browser installation for monitor ${monitor.id}`);
      await ensurePlaywrightBrowsersInstalled();
    }

    const result = await monitorEngine.runMonitor({
      id: monitor.id,
      name: monitor.name,
      kind: monitor.kind as any,
      interval: monitor.interval,
      timeout: monitor.timeout ?? undefined,
      config,
    });

    const enrichedResult = suppressed && result.status === "down"
      ? {
          ...result,
          message: `${result.message} (maintenance window)`.replace(/\s+/g, " ").trim(),
          meta: { ...result.meta, maintenanceSuppressed: true },
        }
      : result;

    await handleResult(enrichedResult, { id: monitor.id, name: monitor.name }, { suppressed });
  },
  { connection, concurrency: 2 } // Limit to 2 concurrent monitor executions to prevent resource exhaustion
);

worker.on("failed", async (job, err) => {
  log.error("Monitor job failed", job?.id, err);

  // Create a failed check result when monitor execution fails
  if (job?.data?.monitorId) {
    try {
      const monitor = await prisma.monitor.findUnique({
        where: { id: job.data.monitorId },
        select: { id: true, name: true }
      });

      if (monitor) {
        const failureResult = {
          monitorId: monitor.id,
          status: "down" as const,
          message: `Monitor execution failed: ${err instanceof Error ? err.message : String(err)}`,
          checkedAt: new Date().toISOString(),
        };

        await handleResult(failureResult, monitor, { suppressed: false });
      }
    } catch (handleError) {
      log.error("Failed to handle monitor job failure:", handleError);
    }
  }
});

const scheduleMonitor = async (monitorId: string, interval: number) => {
  try {
    log.info(`[Monitor Orchestrator] Scheduling monitor ${monitorId} with interval ${interval}ms`);
    await monitorQueue.add(
      "monitor",
      { monitorId },
      {
        repeat: { every: interval },
        jobId: `monitor:${monitorId}`,
        removeOnComplete: true,
      }
    );
    log.info(`[Monitor Orchestrator] Successfully scheduled monitor ${monitorId}`);
  } catch (error) {
    log.error(`[Monitor Orchestrator] Failed to schedule monitor ${monitorId}:`, error);
    throw error;
  }
};

const cancelMonitor = async (monitorId: string) => {
  await monitorQueue.removeRepeatable("monitor", { jobId: `monitor:${monitorId}` });
};

const runMonitorCheck = async (monitorId: string): Promise<MonitorResult> => {
  const monitor = await prisma.monitor.findUnique({
    where: { id: monitorId },
    include: { heartbeats: true },
  });

  if (!monitor) {
    throw new Error("Monitor not found");
  }

  const config = toConfigObject(monitor.config);
  
  // Inject global certificate expiry threshold for certificate monitors
  if (monitor.kind === "certificate") {
    const certExpiryThreshold = await settingsService.get<number>("certExpiryThresholdDays", 30);
    const certConfig = config as Record<string, unknown> & { warningDays?: number };
    // Use global setting if not set in monitor config
    if (certConfig.warningDays === undefined) {
      certConfig.warningDays = certExpiryThreshold;
    }
  }
  
  if (monitor.kind === "push" && monitor.heartbeats) {
    const pushConfig = config as Record<string, unknown> & {
      heartbeatSeconds?: number;
      lastHeartbeatAt?: string;
    };
    if (typeof pushConfig.heartbeatSeconds !== "number") {
      pushConfig.heartbeatSeconds = monitor.heartbeats.heartbeatEvery;
    }
    pushConfig.lastHeartbeatAt = monitor.heartbeats.lastHeartbeat?.toISOString() ?? undefined;
  }

  const suppressed = await maintenanceService.isSuppressed(monitor.id);
  const result = await monitorEngine.runMonitor({
    id: monitor.id,
    name: monitor.name,
    kind: monitor.kind as any,
    interval: monitor.interval,
    timeout: monitor.timeout ?? undefined,
    config,
  });

  const enrichedResult = suppressed && result.status === "down"
    ? {
        ...result,
        message: `${result.message} (maintenance window)`.replace(/\s+/g, " ").trim(),
        meta: { ...result.meta, maintenanceSuppressed: true },
      }
    : result;

  // Handle the result (save to DB, send notifications, etc.)
  await handleResult(enrichedResult, { id: monitor.id, name: monitor.name }, { suppressed });

  return enrichedResult;
};

const bootstrapMonitors = async () => {
  log.info('[Monitor Orchestrator] Starting bootstrap process...');
  const monitors = await prisma.monitor.findMany({ 
    where: { paused: false },
    select: { id: true, name: true, interval: true } 
  });
  log.info(`[Monitor Orchestrator] Found ${monitors.length} active monitors to schedule`);
  
  const results = await Promise.allSettled(
    monitors.map(({ id, name, interval }: { id: string; name: string; interval: number }) => {
      log.info(`[Monitor Orchestrator] Scheduling monitor: ${name} (${id})`);
      return scheduleMonitor(id, interval);
    })
  );
  
  const successful = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;
  
  if (failed > 0) {
    log.error(`[Monitor Orchestrator] Bootstrap completed with errors: ${successful} succeeded, ${failed} failed`);
    results.forEach((result, idx) => {
      if (result.status === 'rejected') {
        log.error(`[Monitor Orchestrator] Failed to schedule ${monitors[idx].name}:`, result.reason);
      }
    });
  } else {
    log.info(`[Monitor Orchestrator] Bootstrap completed successfully: ${successful} monitors scheduled`);
  }
};

const handleResult = async (
  result: MonitorResult,
  monitor?: { id: string; name: string },
  options?: { suppressed?: boolean }
) => {
  // Extract screenshots from journey steps before storing
  const journeySteps = result.meta?.journeySteps || [];
  const screenshots: Array<{ stepIndex: number; stepLabel: string; screenshotData: string }> = [];

  // Extract screenshots from failed steps only
  journeySteps.forEach((step: any, index: number) => {
    if (step.status === 'down' && step.screenshot) {
      screenshots.push({
        stepIndex: index,
        stepLabel: step.label,
        screenshotData: step.screenshot,
      });
    }
  });

  // Create check result with simplified payload (no large binary data)
  const checkResult = await prisma.checkResult.create({
    data: {
      monitorId: result.monitorId,
      status: result.status,
      latencyMs: result.meta?.latencyMs ?? null,
      payload: serializeJson({
        ...result.meta,
        journeySteps: journeySteps.map((step: any) => ({
          ...step,
          screenshot: undefined, // Remove screenshot from payload
        })),
      }),
    },
  });

  // Store screenshots separately if any exist
  if (screenshots.length > 0) {
    await prisma.checkScreenshot.createMany({
      data: screenshots.map(screenshot => ({
        checkResultId: checkResult.id,
        stepIndex: screenshot.stepIndex,
        stepLabel: screenshot.stepLabel,
        screenshotData: screenshot.screenshotData,
      })),
    });
  }

  broadcastBus.emitResult(result);

  if (!options?.suppressed) {
    await notificationRouter.route(result);
  }

  await incidentManager.process(result, monitor, options);
};

export const monitorOrchestrator = {
  queue: monitorQueue,
  scheduleMonitor,
  cancelMonitor,
  runMonitorCheck,
  bootstrap: bootstrapMonitors,
  handleResult,
};

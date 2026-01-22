import { MonitorEngine, type MonitorResult } from "@uptivalab/monitoring";
import { Queue, Worker } from "bullmq";
import { Redis } from "ioredis";
import { prisma } from "../../db/prisma.js";
import { appConfig } from "../../config.js";
import { broadcastBus } from "../../realtime/events.js";
import { notificationRouter } from "../notifications/router.js";
import { maintenanceService } from "../maintenance/suppressor.js";
import { incidentManager } from "../incidents/manager.js";
import { settingsService } from "../settings/service.js";

const toConfigObject = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return { ...(value as Record<string, unknown>) };
  }
  return {};
};

const serializeJson = (value: unknown): any => {
  return value === undefined ? {} : JSON.parse(JSON.stringify(value));
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
  { connection }
);

worker.on("failed", async (job, err) => {
  console.error("Monitor job failed", job?.id, err);

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
      console.error("Failed to handle monitor job failure:", handleError);
    }
  }
});

const scheduleMonitor = async (monitorId: string, interval: number) => {
  try {
    console.log(`[Monitor Orchestrator] Scheduling monitor ${monitorId} with interval ${interval}ms`);
    await monitorQueue.add(
      "monitor",
      { monitorId },
      {
        repeat: { every: interval },
        jobId: `monitor:${monitorId}`,
        removeOnComplete: true,
      }
    );
    console.log(`[Monitor Orchestrator] Successfully scheduled monitor ${monitorId}`);
  } catch (error) {
    console.error(`[Monitor Orchestrator] Failed to schedule monitor ${monitorId}:`, error);
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
  console.log('[Monitor Orchestrator] Starting bootstrap process...');
  const monitors = await prisma.monitor.findMany({ 
    where: { paused: false },
    select: { id: true, name: true, interval: true } 
  });
  console.log(`[Monitor Orchestrator] Found ${monitors.length} active monitors to schedule`);
  
  const results = await Promise.allSettled(
    monitors.map(({ id, name, interval }: { id: string; name: string; interval: number }) => {
      console.log(`[Monitor Orchestrator] Scheduling monitor: ${name} (${id})`);
      return scheduleMonitor(id, interval);
    })
  );
  
  const successful = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;
  
  if (failed > 0) {
    console.error(`[Monitor Orchestrator] Bootstrap completed with errors: ${successful} succeeded, ${failed} failed`);
    results.forEach((result, idx) => {
      if (result.status === 'rejected') {
        console.error(`[Monitor Orchestrator] Failed to schedule ${monitors[idx].name}:`, result.reason);
      }
    });
  } else {
    console.log(`[Monitor Orchestrator] Bootstrap completed successfully: ${successful} monitors scheduled`);
  }
};

const handleResult = async (
  result: MonitorResult,
  monitor?: { id: string; name: string },
  options?: { suppressed?: boolean }
) => {
  await prisma.checkResult.create({
    data: {
      monitorId: result.monitorId,
      status: result.status,
      latencyMs: result.meta?.latencyMs ?? null,
      payload: serializeJson(result.meta ?? {}),
    },
  });

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

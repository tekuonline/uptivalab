import { MonitorEngine, type MonitorResult } from "@uptivalab/monitoring";
import { Queue, Worker } from "bullmq";
import { Redis } from "ioredis";
import { prisma } from "../../db/prisma.js";
import { appConfig } from "../../config.js";
import { broadcastBus } from "../../realtime/events.js";
import { notificationRouter } from "../notifications/router.js";
import { maintenanceService } from "../maintenance/suppressor.js";
import { incidentManager } from "../incidents/manager.js";

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

worker.on("failed", (job, err) => {
  console.error("Monitor job failed", job?.id, err);
});

const scheduleMonitor = async (monitorId: string, interval: number) => {
  await monitorQueue.add(
    "monitor",
    { monitorId },
    {
      repeat: { every: interval },
      jobId: `monitor:${monitorId}`,
      removeOnComplete: true,
    }
  );
};

const cancelMonitor = async (monitorId: string) => {
  await monitorQueue.removeRepeatable("monitor", { jobId: `monitor:${monitorId}` });
};

const bootstrapMonitors = async () => {
  const monitors = await prisma.monitor.findMany({ 
    where: { paused: false },
    select: { id: true, interval: true } 
  });
  await Promise.all(monitors.map(({ id, interval }: { id: string; interval: number }) => scheduleMonitor(id, interval)));
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
  bootstrap: bootstrapMonitors,
  handleResult,
};

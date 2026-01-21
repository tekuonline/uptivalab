import { Queue, Worker } from "bullmq";
import { Redis } from "ioredis";
import { appConfig } from "../../config.js";
import { prisma } from "../../db/prisma.js";
import { maintenanceNotifier } from "./notifier.js";

const connection = new Redis(appConfig.REDIS_URL, { maxRetriesPerRequest: null });

const queueName = "maintenance-scheduler";
const maintenanceQueue = new Queue(queueName, { connection });

// Worker to handle maintenance window notifications
const worker = new Worker(
  queueName,
  async (job) => {
    if (job.name === "check-maintenance") {
      await checkMaintenanceWindows();
    } else if (job.name === "notify-start") {
      await maintenanceNotifier.notifyWindowStart(job.data.windowId);
    } else if (job.name === "notify-end") {
      await maintenanceNotifier.notifyWindowEnd(job.data.windowId);
    }
  },
  { connection }
);

worker.on("failed", (job, err) => {
  console.error("[Maintenance Scheduler] Job failed:", job?.name, err);
});

// Check for maintenance windows that are starting or ending soon
async function checkMaintenanceWindows() {
  const now = new Date();
  const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

  // Find windows starting in the next 5 minutes that haven't been notified yet
  const startingWindows = await prisma.maintenanceWindow.findMany({
    where: {
      startsAt: {
        gte: now,
        lte: fiveMinutesFromNow,
      },
      // We'll use a custom field to track if start notification was sent
      // For now, we check if startsAt is within 5 minutes
    },
  });

  // Find windows ending in the next 5 minutes
  const endingWindows = await prisma.maintenanceWindow.findMany({
    where: {
      endsAt: {
        gte: now,
        lte: fiveMinutesFromNow,
      },
    },
  });

  // Schedule start notifications
  for (const window of startingWindows) {
    const delay = window.startsAt.getTime() - now.getTime();
    if (delay > 0 && delay <= 5 * 60 * 1000) {
      await maintenanceQueue.add(
        "notify-start",
        { windowId: window.id },
        {
          delay,
          jobId: `notify-start:${window.id}`,
          removeOnComplete: true,
        }
      );
    }
  }

  // Schedule end notifications
  for (const window of endingWindows) {
    const delay = window.endsAt.getTime() - now.getTime();
    if (delay > 0 && delay <= 5 * 60 * 1000) {
      await maintenanceQueue.add(
        "notify-end",
        { windowId: window.id },
        {
          delay,
          jobId: `notify-end:${window.id}`,
          removeOnComplete: true,
        }
      );
    }
  }
}

// Bootstrap: Schedule periodic checks every minute
export async function bootstrapMaintenanceScheduler() {
  // Clear any existing jobs
  await maintenanceQueue.obliterate({ force: true });

  // Add recurring job to check for maintenance windows every minute
  await maintenanceQueue.add(
    "check-maintenance",
    {},
    {
      repeat: { every: 60_000 }, // Every 1 minute
      jobId: "maintenance-check",
      removeOnComplete: true,
    }
  );
}

export const maintenanceScheduler = {
  queue: maintenanceQueue,
  bootstrap: bootstrapMaintenanceScheduler,
  checkNow: checkMaintenanceWindows,
};

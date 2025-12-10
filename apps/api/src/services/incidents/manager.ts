import type { MonitorResult } from "@uptivalab/monitoring";
import { prisma } from "../../db/prisma.js";
import { broadcastBus } from "../../realtime/events.js";
import { emailNotifier } from "../notifications/smtp.js";
import { webhookNotifier } from "../notifications/webhook.js";
import { ntfyNotifier } from "../notifications/ntfy.js";

type IncidentStatus = "OPEN" | "INVESTIGATING" | "MITIGATED" | "RESOLVED";
type MonitorShape = { id: string; name: string };

const activeStatuses: IncidentStatus[] = ["OPEN", "INVESTIGATING"];

const createEvent = async (incidentId: string, message: string) =>
  prisma.incidentEvent.create({
    data: { incidentId, message },
  });

const sendNotification = async (
  monitorId: string,
  status: IncidentStatus,
  message: string,
  monitor?: MonitorShape
) => {
  try {
    // Fetch monitor with notification channels
    const fullMonitor = await prisma.monitor.findUnique({
      where: { id: monitorId },
      include: {
        notificationChannels: true,
      },
    });

    if (!fullMonitor) {
      return;
    }

    if (fullMonitor.notificationChannels.length === 0) {
      return;
    }

    // Map incident status to emoji
    const statusEmoji = {
      OPEN: "🔴",
      INVESTIGATING: "🟠",
      MITIGATED: "🟡",
      RESOLVED: "🟢",
    }[status] || "⚪";

    // Create a notification result object
    const notificationResult: MonitorResult = {
      monitorId,
      status: status === "RESOLVED" ? "up" : "down",
      message: `${statusEmoji} Incident ${status}: ${message}`,
      checkedAt: new Date().toISOString(),
    };

    // Adapters for notification types
    const adapters = {
      email: emailNotifier,
      webhook: webhookNotifier,
      ntfy: ntfyNotifier,
    } as const;

    // Send notification to each configured channel
    await Promise.all(
      fullMonitor.notificationChannels.map(async (channel: any) => {
        const adapter = adapters[channel.type as keyof typeof adapters];
        if (!adapter) return;
        await adapter.send(channel, notificationResult);
      })
    );
  } catch (error) {
    console.error("[Incident Notification] Failed to send:", error);
  }
};

const emitUpdate = (incident: {
  id: string;
  monitorId: string;
  status: IncidentStatus;
  startedAt: Date;
  resolvedAt: Date | null;
}) => {
  broadcastBus.emitIncidentUpdate({
    id: incident.id,
    status: incident.status,
    monitorId: incident.monitorId,
    startedAt: incident.startedAt,
    resolvedAt: incident.resolvedAt,
  });
};

const ensureIncident = async (monitorId: string, message: string, monitor?: MonitorShape) => {
  const existing = await prisma.incident.findFirst({
    where: { monitorId, status: { in: activeStatuses } },
  });
  if (existing) {
    await createEvent(existing.id, message);
    emitUpdate(existing);
    return existing;
  }

  const incident = await prisma.incident.create({
    data: {
      monitorId,
      status: "OPEN",
      events: { create: { message: monitor ? `${monitor.name}: ${message}` : message } },
    },
  });
  emitUpdate(incident);
  
  // Send notification for new incident
  await sendNotification(monitorId, "OPEN", message, monitor);
  
  return incident;
};

const resolveIncident = async (monitorId: string, message: string, monitor?: MonitorShape) => {
  const incident = await prisma.incident.findFirst({
    where: { monitorId, status: { in: activeStatuses } },
  });
  if (!incident) return null;

  const resolved = await prisma.incident.update({
    where: { id: incident.id },
    data: {
      status: "RESOLVED",
      resolvedAt: new Date(),
      events: { create: { message } },
    },
  });
  emitUpdate(resolved);
  
  // Send notification for resolved incident
  await sendNotification(monitorId, "RESOLVED", message, monitor);
  
  return resolved;
};

export const incidentManager = {
  async process(result: MonitorResult, monitor?: MonitorShape, options?: { suppressed?: boolean }) {
    if (options?.suppressed) return;

    if (result.status === "down") {
      await ensureIncident(result.monitorId, result.message, monitor);
    } else if (result.status === "up") {
      await resolveIncident(result.monitorId, result.message, monitor);
    }
  },

  async addEvent(incidentId: string, message: string) {
    return createEvent(incidentId, message);
  },
  
  async notify(monitorId: string, status: IncidentStatus, message: string, monitor?: MonitorShape) {
    return sendNotification(monitorId, status, message, monitor);
  },
};

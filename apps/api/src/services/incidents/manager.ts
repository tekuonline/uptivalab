import type { MonitorResult } from "@uptivalab/monitoring";
import { prisma } from "../../db/prisma.js";
import { appConfig } from "../../config.js";
import { broadcastBus } from "../../realtime/events.js";
import { emailNotifier } from "../notifications/smtp.js";
import { webhookNotifier } from "../notifications/webhook.js";
import { ntfyNotifier } from "../notifications/ntfy.js";
import { settingsService } from "../settings/service.js";

type IncidentStatus = "OPEN" | "INVESTIGATING" | "MITIGATED" | "RESOLVED";
type MonitorShape = { id: string; name: string };

const activeStatuses: IncidentStatus[] = ["OPEN", "INVESTIGATING"];

// Track last notification time per monitor for rate limiting
const lastNotificationTime = new Map<string, number>();

const createEvent = async (incidentId: string, message: string) =>
  prisma.incidentEvent.create({
    data: { incidentId, message },
  });

const isInQuietHours = (startTime: string, endTime: string): boolean => {
  const now = new Date();
  const currentTime = now.getHours() * 60 + now.getMinutes();
  
  const [startHour, startMin] = startTime.split(":").map(Number);
  const [endHour, endMin] = endTime.split(":").map(Number);
  const start = startHour * 60 + startMin;
  const end = endHour * 60 + endMin;
  
  // Handle quiet hours spanning midnight
  if (start > end) {
    return currentTime >= start || currentTime < end;
  }
  return currentTime >= start && currentTime < end;
};

const shouldSendNotification = async (
  monitorId: string,
  status: IncidentStatus
): Promise<boolean> => {
  // Check global notification preferences
  const notifyOnUp = await settingsService.get<boolean>("notifyOnMonitorUp", true);
  const notifyOnDown = await settingsService.get<boolean>("notifyOnMonitorDown", true);
  
  if (status === "RESOLVED" && !notifyOnUp) {
    return false;
  }
  
  if ((status === "OPEN" || status === "INVESTIGATING") && !notifyOnDown) {
    return false;
  }
  
  // Check rate limiting
  const minInterval = await settingsService.get<number>("notificationMinInterval", 5) ?? 5;
  const lastTime = lastNotificationTime.get(monitorId);
  const now = Date.now();
  
  if (lastTime && (now - lastTime) < minInterval * 60 * 1000) {
    console.log(`[Notification] Rate limited for monitor ${monitorId}`);
    return false;
  }
  
  // Check quiet hours
  const enableQuietHours = await settingsService.get<boolean>("enableQuietHours", false);
  if (enableQuietHours) {
    const quietHoursStart = await settingsService.get<string>("quietHoursStart", "22:00") ?? "22:00";
    const quietHoursEnd = await settingsService.get<string>("quietHoursEnd", "08:00") ?? "08:00";
    
    if (isInQuietHours(quietHoursStart, quietHoursEnd)) {
      console.log(`[Notification] Suppressed due to quiet hours`);
      return false;
    }
  }
  
  // Update last notification time
  lastNotificationTime.set(monitorId, now);
  return true;
};

const sendNotification = async (
  monitorId: string,
  status: IncidentStatus,
  message: string,
  monitor?: MonitorShape
) => {
  try {
    // Check if notification should be sent based on global settings
    const shouldSend = await shouldSendNotification(monitorId, status);
    if (!shouldSend) {
      console.log(`[Incident Manager] Notification suppressed for monitor ${monitorId} (status: ${status})`);
      return;
    }
    
    console.log(`[Incident Manager] Processing notification for monitor ${monitorId} (status: ${status})`);
    
    // Fetch monitor with notification channels
    const fullMonitor = await prisma.monitor.findUnique({
      where: { id: monitorId },
      include: {
        notificationChannels: true,
      },
    });

    if (!fullMonitor) {
      console.warn(`[Incident Manager] Monitor ${monitorId} not found`);
      return;
    }

    if (fullMonitor.notificationChannels.length === 0) {
      console.warn(`[Incident Manager] No notification channels configured for monitor ${monitorId}`);
      return;
    }

    console.log(`[Incident Manager] Sending incident notifications to ${fullMonitor.notificationChannels.length} channel(s) for monitor ${monitorId}`);

    // Map incident status to emoji
    const statusEmoji = {
      OPEN: "🔴",
      INVESTIGATING: "🟠",
      MITIGATED: "🟡",
      RESOLVED: "🟢",
    }[status] || "⚪";

    // Create a notification result object
    const monitorLink = `${appConfig.BASE_URL}/monitors/${monitorId}`;
    const notificationResult: MonitorResult & { monitorName: string } = {
      monitorId,
      monitorName: fullMonitor.name,
      status: status === "RESOLVED" ? "up" : "down",
      message: `${statusEmoji} Incident ${status}: ${message}\n\nView details: ${monitorLink}`,
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
        if (!adapter) {
          console.warn(`[Incident Manager] No adapter found for channel type: ${channel.type}`);
          return;
        }
        try {
          await adapter.send(channel, notificationResult);
          console.log(`[Incident Manager] Successfully sent incident notification via ${channel.type} (${channel.name})`);
        } catch (error) {
          console.error(`[Incident Manager] Failed to send incident notification via ${channel.type} (${channel.name}):`, error);
        }
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

const ensureIncident = async (monitorId: string, message: string, monitor?: MonitorShape & { createIncidents?: boolean }) => {
  // Skip incident creation if monitor has createIncidents disabled
  if (monitor?.createIncidents === false) {
    return null;
  }
  
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

const resolveIncident = async (monitorId: string, message: string, monitor?: MonitorShape & { createIncidents?: boolean }) => {
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
  async process(result: MonitorResult, monitor?: MonitorShape & { createIncidents?: boolean }, options?: { suppressed?: boolean }) {
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

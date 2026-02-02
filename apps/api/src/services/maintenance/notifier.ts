import { prisma } from "../../db/prisma.js";
import { emailNotifier } from "../notifications/smtp.js";
import { webhookNotifier } from "../notifications/webhook.js";
import { ntfyNotifier } from "../notifications/ntfy.js";
import type { MonitorResult } from "@uptivalab/monitoring";
import { log } from "../../utils/logger.js";

export const maintenanceNotifier = {
  async notifyWindowStart(windowId: string) {
    const window = await prisma.maintenanceWindow.findUnique({
      where: { id: windowId },
      include: {
        monitors: {
          include: {
            notificationChannels: true,
          },
        },
      },
    });

    if (!window) return;

    const adapters = {
      email: emailNotifier,
      webhook: webhookNotifier,
      ntfy: ntfyNotifier,
    } as const;

    // Send notification to each affected monitor's channels
    for (const monitor of window.monitors) {
      if (monitor.notificationChannels.length === 0) continue;

      const startDate = window.startsAt.toISOString().split('T')[0];
      const endDate = window.endsAt.toISOString().split('T')[0];
      const notificationResult: MonitorResult = {
        monitorId: monitor.id,
        status: "up",
        message: `🔧 Maintenance window started: "${window.name}" (${startDate} - ${endDate})`,
        checkedAt: new Date().toISOString(),
        meta: {
          maintenanceWindow: window.name,
          startsAt: window.startsAt.toISOString(),
          endsAt: window.endsAt.toISOString(),
        } as any,
      };

      await Promise.all(
        monitor.notificationChannels.map(async (channel: any) => {
          const adapter = adapters[channel.type as keyof typeof adapters];
          if (!adapter) return;
          try {
            await adapter.send(channel, notificationResult);
          } catch (error) {
            log.error(`[Maintenance Notifier] Failed to send start notification:`, { error });
          }
        })
      );
    }
  },

  async notifyWindowEnd(windowId: string) {
    const window = await prisma.maintenanceWindow.findUnique({
      where: { id: windowId },
      include: {
        monitors: {
          include: {
            notificationChannels: true,
          },
        },
      },
    });

    if (!window) return;

    const adapters = {
      email: emailNotifier,
      webhook: webhookNotifier,
      ntfy: ntfyNotifier,
    } as const;

    // Send notification to each affected monitor's channels
    for (const monitor of window.monitors) {
      if (monitor.notificationChannels.length === 0) continue;

      const notificationResult: MonitorResult = {
        monitorId: monitor.id,
        status: "up",
        message: `✅ Maintenance window ended: "${window.name}". Monitoring has resumed.`,
        checkedAt: new Date().toISOString(),
        meta: {
          maintenanceWindow: window.name,
          startsAt: window.startsAt.toISOString(),
          endsAt: window.endsAt.toISOString(),
        } as any,
      };

      await Promise.all(
        monitor.notificationChannels.map(async (channel: any) => {
          const adapter = adapters[channel.type as keyof typeof adapters];
          if (!adapter) return;
          try {
            await adapter.send(channel, notificationResult);
          } catch (error) {
            log.error(`[Maintenance Notifier] Failed to send end notification:`, { error });
          }
        })
      );
    }
  },
};

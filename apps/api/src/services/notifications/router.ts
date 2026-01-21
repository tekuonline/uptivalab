import { prisma } from "../../db/prisma.js";
import type { MonitorResult } from "@uptivalab/monitoring";
import { appConfig } from "../../config.js";
import { emailNotifier } from "./smtp.js";
import { webhookNotifier } from "./webhook.js";
import { ntfyNotifier } from "./ntfy.js";

const adapters = {
  email: emailNotifier,
  webhook: webhookNotifier,
  ntfy: ntfyNotifier,
} as const;

export const notificationRouter = {
  async route(result: MonitorResult) {
    // Fetch monitor name
    const monitor = await prisma.monitor.findUnique({
      where: { id: result.monitorId },
      select: { name: true },
    });
    
    // Get the previous check (skip the most recent which was just saved)
    const previousChecks = await prisma.checkResult.findMany({
      where: { monitorId: result.monitorId },
      orderBy: { checkedAt: "desc" },
      select: { status: true },
      take: 2, // Get last 2 checks (current + previous)
    });

    // If there's only 1 check (the one just saved), this is the first check
    // If there are 2 checks, compare current with the previous (index 1)
    const statusChanged = previousChecks.length === 1 || 
                         (previousChecks.length === 2 && previousChecks[1].status !== result.status);
    
    if (!statusChanged) {
      console.log(`[Notification Router] Status unchanged for monitor ${result.monitorId}, skipping notification`);
      return; // Skip notification - status hasn't changed
    }

    console.log(`[Notification Router] Status changed for monitor ${result.monitorId}: ${result.status}`);

    const bindings = await prisma.notificationChannel.findMany({
      where: {
        monitors: { some: { id: result.monitorId } },
      },
    });

    if (bindings.length === 0) {
      console.warn(`[Notification Router] No notification channels configured for monitor ${result.monitorId}`);
      return;
    }

    console.log(`[Notification Router] Sending notifications to ${bindings.length} channel(s) for monitor ${result.monitorId}`);

    // Add emoji to the message based on status
    const statusEmoji = result.status === "up" ? "🟢" : "🔴";
    const monitorLink = `${appConfig.BASE_URL}/monitors/${result.monitorId}`;
    const enrichedResult = {
      ...result,
      monitorName: monitor?.name || "Unknown Monitor",
      message: `${statusEmoji} ${result.message}\n\nView details: ${monitorLink}`,
    };

    await Promise.all(
      bindings.map(async (channel: any) => {
        const adapter = adapters[channel.type as keyof typeof adapters];
        if (!adapter) {
          console.warn(`[Notification Router] No adapter found for channel type: ${channel.type}`);
          return;
        }
        try {
          await adapter.send(channel, enrichedResult);
          console.log(`[Notification Router] Successfully sent notification via ${channel.type} (${channel.name})`);
        } catch (error) {
          console.error(`[Notification Router] Failed to send notification via ${channel.type} (${channel.name}):`, error);
        }
      })
    );
  },
};

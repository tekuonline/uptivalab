import { prisma } from "../../db/prisma.js";
import type { MonitorResult } from "@uptivalab/monitoring";
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
      return; // Skip notification - status hasn't changed
    }

    const bindings = await prisma.notificationChannel.findMany({
      where: {
        monitors: { some: { id: result.monitorId } },
      },
    });

    // Add emoji to the message based on status
    const statusEmoji = result.status === "up" ? "🟢" : "🔴";
    const enrichedResult = {
      ...result,
      message: `${statusEmoji} ${result.message}`,
    };

    await Promise.all(
      bindings.map(async (channel: any) => {
        const adapter = adapters[channel.type as keyof typeof adapters];
        if (!adapter) return;
        await adapter.send(channel, enrichedResult);
      })
    );
  },
};

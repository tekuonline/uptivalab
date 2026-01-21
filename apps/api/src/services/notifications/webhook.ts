import type { NotificationChannel } from "@prisma/client";
import type { MonitorResult } from "@uptivalab/monitoring";
import { type NotificationAdapter, readChannelConfig } from "./base.js";

const send = async (channel: NotificationChannel, result: MonitorResult) => {
  const config = readChannelConfig<{ url?: string }>(channel);
  const url = config.url;
  
  if (!url) {
    console.error(`[Webhook Notifier] No URL configured for channel ${channel.name}`);
    throw new Error("Webhook URL not configured");
  }
  
  console.log(`[Webhook Notifier] Sending notification to ${url}`);
  
  try {
    const monitorName = (result as any).monitorName || "Unknown Monitor";
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        monitorName: monitorName,
        status: result.status,
        message: result.message,
        checkedAt: result.checkedAt,
        meta: result.meta,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    console.log(`[Webhook Notifier] Successfully sent notification to ${url}`);
  } catch (error) {
    console.error(`[Webhook Notifier] Failed to send notification to ${url}:`, error);
    throw error;
  }
};

export const webhookNotifier: NotificationAdapter = {
  send,
};

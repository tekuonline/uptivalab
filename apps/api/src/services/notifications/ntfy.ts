import type { NotificationChannel } from "@prisma/client";
import type { MonitorResult } from "@uptivalab/monitoring";
import { type NotificationAdapter, readChannelConfig } from "./base.js";
import { log } from "../../utils/logger.js";

const send = async (channel: NotificationChannel, result: MonitorResult) => {
  const config = readChannelConfig<{
    topic?: string;
    tags?: string[];
    priority?: number;
  }>(channel);
  const topic = config.topic;
  
  if (!topic) {
    log.error(`[Ntfy Notifier] No topic configured for channel ${channel.name}`);
    throw new Error("Ntfy topic not configured");
  }
  
  const url = `https://ntfy.sh/${topic}`;
  log.info(`[Ntfy Notifier] Sending notification to ${url}`);
  
  try {
    const monitorName = (result as any).monitorName || "Unknown Monitor";
    
    // Extract monitor link from message (format: "...View details: <url>")
    const linkMatch = result.message.match(/View details: (https?:\/\/[^\s]+)/);
    const monitorLink = linkMatch ? linkMatch[1] : undefined;
    
    // Remove the link line from the message body
    const messageBody = result.message.replace(/\n\nView details: https?:\/\/[^\s]+/, "");
    
    const headers: Record<string, string> = {
      Title: `[UptivaLab] ${monitorName} - ${result.status.toUpperCase()}`,
      Tags: (config.tags ?? ["uptivalab"]).join(","),
      Priority: String(config.priority ?? 3),
    };
    
    // Add Click header if monitor link is found
    if (monitorLink) {
      headers.Click = monitorLink;
    }
    
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: messageBody,
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    log.info(`[Ntfy Notifier] Successfully sent notification to ${url}`);
  } catch (error) {
    log.error(`[Ntfy Notifier] Failed to send notification to ${url}:`, { error });
    throw error;
  }
};

export const ntfyNotifier: NotificationAdapter = {
  send,
};

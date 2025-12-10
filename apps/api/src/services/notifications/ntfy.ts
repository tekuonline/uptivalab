import type { NotificationChannel } from "@prisma/client";
import type { MonitorResult } from "@uptivalab/monitoring";
import { type NotificationAdapter, readChannelConfig } from "./base.js";

const send = async (channel: NotificationChannel, result: MonitorResult) => {
  const config = readChannelConfig<{
    topic?: string;
    tags?: string[];
    priority?: number;
  }>(channel);
  const topic = config.topic;
  if (!topic) return;
  const url = `https://ntfy.sh/${topic}`;
  await fetch(url, {
    method: "POST",
    headers: {
      Title: `[UptivaLab] ${result.status.toUpperCase()}`,
      Tags: (config.tags ?? ["uptivalab"]).join(","),
      Priority: String(config.priority ?? 3),
    },
    body: result.message,
  });
};

export const ntfyNotifier: NotificationAdapter = {
  send,
};

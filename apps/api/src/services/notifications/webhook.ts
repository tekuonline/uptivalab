import type { NotificationChannel } from "@prisma/client";
import type { MonitorResult } from "@uptivalab/monitoring";
import { type NotificationAdapter, readChannelConfig } from "./base.js";

const send = async (channel: NotificationChannel, result: MonitorResult) => {
  const config = readChannelConfig<{ url?: string }>(channel);
  const url = config.url;
  if (!url) return;
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      monitorId: result.monitorId,
      status: result.status,
      message: result.message,
      checkedAt: result.checkedAt,
      meta: result.meta,
    }),
  });
};

export const webhookNotifier: NotificationAdapter = {
  send,
};

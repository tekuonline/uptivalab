import type { NotificationChannel } from "@prisma/client";
import type { MonitorResult } from "@uptivalab/monitoring";

export interface NotificationAdapter {
  send(channel: NotificationChannel, result: MonitorResult): Promise<void>;
}

export type NotificationConfig = Record<string, unknown>;

export const readChannelConfig = <T extends NotificationConfig = NotificationConfig>(channel: NotificationChannel): T => {
  const config = channel.config;
  if (config && typeof config === "object" && !Array.isArray(config)) {
    return config as T;
  }
  return {} as T;
};

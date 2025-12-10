import type { BaseMonitor, MonitorAdapter, MonitorResult, PushConfig } from "../types.js";

const toConfig = (config: Record<string, unknown>): PushConfig => {
  if (typeof config.heartbeatSeconds !== "number") {
    throw new Error("Push monitor requires heartbeatSeconds");
  }
  return {
    heartbeatSeconds: config.heartbeatSeconds,
    lastHeartbeatAt: typeof config.lastHeartbeatAt === "string" ? config.lastHeartbeatAt : undefined,
  };
};

export const pushAdapter: MonitorAdapter = {
  kind: "push",
  supports: () => true,
  async execute(monitor: BaseMonitor): Promise<MonitorResult> {
    const config = toConfig(monitor.config);
    const lastHeartbeat = config.lastHeartbeatAt ? new Date(config.lastHeartbeatAt) : null;
    const windowMs = config.heartbeatSeconds * 1000;
    const isAlive = lastHeartbeat ? Date.now() - lastHeartbeat.getTime() <= windowMs : false;

    return {
      monitorId: monitor.id,
      status: isAlive ? "up" : "down",
      message: isAlive ? "Heartbeat OK" : "Heartbeat overdue",
      checkedAt: new Date().toISOString(),
      meta: {
        pushWindowSeconds: config.heartbeatSeconds,
        heartbeatReceivedAt: lastHeartbeat?.toISOString() ?? null,
      },
    };
  },
};

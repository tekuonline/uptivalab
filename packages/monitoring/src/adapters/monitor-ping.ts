import { execa } from "execa";
import type { BaseMonitor, MonitorAdapter, MonitorResult, PingConfig } from "../types.js";

const isWindows = process.platform === "win32";

const toConfig = (config: Record<string, unknown>): PingConfig => {
  if (typeof config.host !== "string") {
    throw new Error("Ping monitor requires host");
  }
  return {
    host: config.host,
    packets: typeof config.packets === "number" ? config.packets : 3,
  };
};

export const pingAdapter: MonitorAdapter = {
  kind: "ping",
  supports: () => true,
  async execute(monitor: BaseMonitor): Promise<MonitorResult> {
    const config = toConfig(monitor.config);
    const packets = config.packets ?? 3;
    const args = isWindows ? ["-n", String(packets), config.host] : ["-c", String(packets), config.host];

    try {
      const { stdout } = await execa("ping", args, {
        timeout: monitor.timeout ?? 15000,
      });
      return {
        monitorId: monitor.id,
        status: "up",
        message: `Ping succeeded (${packets} packets)` ,
        checkedAt: new Date().toISOString(),
        meta: {
          resolvedIp: parseResolvedIp(stdout),
        },
      };
    } catch (error) {
      return {
        monitorId: monitor.id,
        status: "down",
        message: error instanceof Error ? error.message : String(error),
        checkedAt: new Date().toISOString(),
      };
    }
  },
};

const parseResolvedIp = (output: string): string | undefined => {
  const match = output.match(/\((?<ip>[\d.:a-f]+)\)/i);
  return match?.groups?.ip;
};

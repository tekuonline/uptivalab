import { Resolver } from "dns/promises";
import type { BaseMonitor, MonitorAdapter, MonitorResult, DnsConfig } from "../types.js";

const toConfig = (config: Record<string, unknown>): DnsConfig => {
  if (typeof config.record !== "string") {
    throw new Error("DNS monitor requires record");
  }
  return {
    record: config.record,
    type: (config.type as DnsConfig["type"]) ?? "A",
    server: typeof config.server === "string" ? config.server : undefined,
  };
};

export const dnsAdapter: MonitorAdapter = {
  kind: "dns",
  supports: () => true,
  async execute(monitor: BaseMonitor): Promise<MonitorResult> {
    const config = toConfig(monitor.config);
    const resolver = new Resolver();
    if (config.server) {
      resolver.setServers([config.server]);
    }

    try {
      const answers = await resolver.resolve(config.record, config.type ?? "A");
      const normalized = Array.isArray(answers)
        ? answers.map((answer) => (typeof answer === "string" ? answer : JSON.stringify(answer)))
        : [String(answers)];

      return {
        monitorId: monitor.id,
        status: "up",
        message: `${config.type ?? "A"} ${config.record} → ${normalized.join(", ")}`,
        checkedAt: new Date().toISOString(),
        meta: {
          dnsAnswers: normalized,
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

import type { BaseMonitor, MonitorAdapter, MonitorResult, HttpConfig } from "../types.js";

const toConfig = (config: Record<string, unknown>): HttpConfig => {
  if (!config.url || typeof config.url !== "string") {
    throw new Error("HTTP monitor requires a url");
  }
  return {
    url: config.url,
    method: typeof config.method === "string" ? config.method : "GET",
    headers: (config.headers as HttpConfig["headers"]) ?? undefined,
    body: typeof config.body === "string" ? config.body : undefined,
    keyword: typeof config.keyword === "string" ? config.keyword : undefined,
    expectStatus: typeof config.expectStatus === "number" ? config.expectStatus : undefined,
    allowInsecure: Boolean(config.allowInsecure),
  };
};

export const httpAdapter: MonitorAdapter = {
  kind: "http",
  supports: () => true,
  async execute(monitor: BaseMonitor): Promise<MonitorResult> {
    const config = toConfig(monitor.config);
    const controller = new AbortController();
    const timeout = monitor.timeout ?? 15000;
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(config.url, {
        method: config.method,
        headers: config.headers as Record<string, string> | undefined,
        body: config.body,
        signal: controller.signal,
      });
      const text = await response.text();

      if (config.expectStatus && response.status !== config.expectStatus) {
        throw new Error(`Expected status ${config.expectStatus}, got ${response.status}`);
      }

      if (config.keyword && !text.includes(config.keyword)) {
        throw new Error(`Keyword '${config.keyword}' missing in response`);
      }

      return {
        monitorId: monitor.id,
        status: "up",
        message: `${response.status} ${response.statusText}`.trim(),
        checkedAt: new Date().toISOString(),
        meta: {
          keywordMatched: config.keyword ? text.includes(config.keyword) : undefined,
        },
      };
    } finally {
      clearTimeout(timer);
    }
  },
};

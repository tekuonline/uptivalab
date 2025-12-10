import { buildDefaultAdapters } from "./adapters/index.js";
import type { BaseMonitor, MonitorAdapter, MonitorResult } from "./types.js";

class TinyEmitter {
  private listeners: Map<string, Array<(payload: unknown) => void>> = new Map();

  on(event: string, handler: (payload: unknown) => void) {
    const existing = this.listeners.get(event) ?? [];
    existing.push(handler);
    this.listeners.set(event, existing);
  }

  emit(event: string, payload: unknown) {
    this.listeners.get(event)?.forEach((handler) => handler(payload));
  }
}

const perf = globalThis.performance ?? {
  now: () => Date.now(),
};

export interface MonitorEngineOptions {
  adapters?: MonitorAdapter[];
}

export class MonitorEngine extends TinyEmitter {
  private readonly adapters: Map<string, MonitorAdapter> = new Map();

  constructor(options: MonitorEngineOptions = {}) {
    super();
  const defaults = options.adapters ?? buildDefaultAdapters();
  defaults.forEach((adapter: MonitorAdapter) => this.adapters.set(adapter.kind, adapter));
  }

  registerAdapter(adapter: MonitorAdapter) {
    this.adapters.set(adapter.kind, adapter);
  }

  async runMonitor(monitor: BaseMonitor): Promise<MonitorResult> {
    const adapter = this.adapters.get(monitor.kind);
    if (!adapter) {
      throw new Error(`No adapter registered for ${monitor.kind}`);
    }

  const start = perf.now();
    try {
  const result = await adapter.execute(monitor);
  const latency = perf.now() - start;
      const enriched: MonitorResult = {
        ...result,
        meta: {
          ...result.meta,
          latencyMs: result.meta?.latencyMs ?? latency,
        },
      };
      this.emit("result", enriched);
      return enriched;
    } catch (error) {
      const failure: MonitorResult = {
        monitorId: monitor.id,
        status: "down",
        message: error instanceof Error ? error.message : String(error),
        checkedAt: new Date().toISOString(),
        meta: {
          latencyMs: perf.now() - start,
        },
      };
      this.emit("result", failure);
      return failure;
    }
  }

  async runBatch(monitors: BaseMonitor[]) {
    return Promise.all(monitors.map((monitor) => this.runMonitor(monitor)));
  }
}

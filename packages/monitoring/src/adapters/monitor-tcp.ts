import net from "net";
import type { BaseMonitor, MonitorAdapter, MonitorResult, TcpConfig } from "../types.js";

const parseConfig = (config: Record<string, unknown>): TcpConfig => {
  if (typeof config.host !== "string" || typeof config.port !== "number") {
    throw new Error("TCP monitor requires host and port");
  }
  return { host: config.host, port: config.port };
};

export const tcpAdapter: MonitorAdapter = {
  kind: "tcp",
  supports: () => true,
  execute(monitor: BaseMonitor) {
    const config = parseConfig(monitor.config);
    const timeout = monitor.timeout ?? 10000;
    return new Promise<MonitorResult>((resolve) => {
      const socket = net.createConnection(config.port, config.host);
      const timer = setTimeout(() => {
        socket.destroy();
        resolve({
          monitorId: monitor.id,
          status: "down",
          message: `Timed out after ${timeout}ms`,
          checkedAt: new Date().toISOString(),
        });
      }, timeout);

      socket.once("connect", () => {
        clearTimeout(timer);
        socket.end();
        resolve({
          monitorId: monitor.id,
          status: "up",
          message: `Connected to ${config.host}:${config.port}`,
          checkedAt: new Date().toISOString(),
        });
      });

      socket.once("error", (error) => {
        clearTimeout(timer);
        resolve({
          monitorId: monitor.id,
          status: "down",
          message: error.message,
          checkedAt: new Date().toISOString(),
        });
      });
    });
  },
};

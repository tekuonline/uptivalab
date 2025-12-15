import tls from "tls";
import type { BaseMonitor, MonitorAdapter, MonitorResult, CertificateConfig } from "../types.js";

const toConfig = (config: Record<string, unknown>): CertificateConfig => {
  if (typeof config.host !== "string") {
    throw new Error("Certificate monitor requires host");
  }
  
  // Strip http:// or https:// protocol from host
  let cleanHost = config.host;
  cleanHost = cleanHost.replace(/^https?:\/\//, '');
  // Remove any trailing slashes or paths
  cleanHost = cleanHost.split('/')[0];
  
  return {
    host: cleanHost,
    port: typeof config.port === "number" ? config.port : 443,
    warningDays: typeof config.warningDays === "number" ? config.warningDays : 7,
  };
};

export const certificateAdapter: MonitorAdapter = {
  kind: "certificate",
  supports: () => true,
  execute(monitor: BaseMonitor): Promise<MonitorResult> {
    const config = toConfig(monitor.config);
    const timeout = monitor.timeout ?? 15000;

    return new Promise((resolve) => {
      const socket = tls.connect(
        {
          host: config.host,
          port: config.port,
          servername: config.host,
          rejectUnauthorized: false,
        },
        () => {
          const cert = socket.getPeerCertificate();
          socket.end();
          const expiresAt = cert.valid_to ? new Date(cert.valid_to) : undefined;
          const daysLeft = expiresAt ? Math.round((expiresAt.getTime() - Date.now()) / 86_400_000) : undefined;
          const status = !expiresAt || daysLeft === undefined || daysLeft > 0 ? "up" : "down";
          const warning = config.warningDays ?? 7;
          const message = expiresAt
            ? `Certificate expires in ${daysLeft} day(s) (${expiresAt.toLocaleDateString()})`
            : "Certificate info unavailable";

          resolve({
            monitorId: monitor.id,
            status,
            message,
            checkedAt: new Date().toISOString(),
            meta: {
              certificateExpiresAt: expiresAt?.toISOString(),
              certificateDaysLeft: daysLeft,
              dockerAvailableUpdates: undefined,
            },
          });
        }
      );

      socket.setTimeout(timeout, () => {
        socket.destroy();
        resolve({
          monitorId: monitor.id,
          status: "down",
          message: `TLS connection timed out after ${timeout}ms`,
          checkedAt: new Date().toISOString(),
        });
      });

      socket.once("error", (error) => {
        socket.destroy();
        resolve({
          monitorId: monitor.id,
          status: "down",
          message: error instanceof Error ? error.message : String(error),
          checkedAt: new Date().toISOString(),
        });
      });
    });
  },
};

import { credentials, loadPackageDefinition } from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";
import type { Client } from "@grpc/grpc-js";
import type { BaseMonitor, MonitorAdapter, MonitorResult, GrpcConfig } from "../types.js";

let healthClientCtorPromise: Promise<any> | null = null;

const getHealthClientCtor = () => {
  if (!healthClientCtorPromise) {
    const protoPath = new URL("../proto/health.proto", import.meta.url);
    healthClientCtorPromise = protoLoader
      .load(protoPath.pathname, {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true,
      })
      .then((definition) => {
        const pkg = loadPackageDefinition(definition) as any;
        return pkg.grpc.health.v1.Health;
      });
  }
  return healthClientCtorPromise;
};

const toConfig = (config: Record<string, unknown>): GrpcConfig => {
  if (typeof config.target !== "string") {
    throw new Error("gRPC monitor requires target");
  }
  return {
    target: config.target,
    service: typeof config.service === "string" ? config.service : undefined,
    deadline: typeof config.deadline === "number" ? config.deadline : 5000,
  };
};

export const grpcAdapter: MonitorAdapter = {
  kind: "grpc",
  supports: () => true,
  async execute(monitor: BaseMonitor): Promise<MonitorResult> {
    const config = toConfig(monitor.config);
    const HealthClientCtor = await getHealthClientCtor();
    const client: Client = new HealthClientCtor(config.target, credentials.createInsecure());

    const request = { service: config.service ?? "" };

    const status = await new Promise<{ code: string; raw: unknown }>((resolve, reject) => {
      const deadline = Date.now() + (config.deadline ?? 5000);
      client.waitForReady(deadline, (readyErr?: Error) => {
        if (readyErr) {
          reject(readyErr);
          return;
        }
        (client as any).check(request, (error: Error | null, response: { status?: number }) => {
          if (error) {
            reject(error);
            return;
          }
          resolve({ code: mapGrpcStatus(response.status), raw: response });
        });
      });
    }).finally(() => client.close());

    return {
      monitorId: monitor.id,
      status: status.code === "SERVING" ? "up" : "down",
      message: `gRPC status ${status.code}`,
      checkedAt: new Date().toISOString(),
      meta: {
        grpcStatus: status.code,
      },
    };
  },
};

const mapGrpcStatus = (code?: number) => {
  switch (code) {
    case 1:
      return "SERVING";
    case 2:
      return "NOT_SERVING";
    case 3:
      return "SERVICE_UNKNOWN";
    default:
      return "UNKNOWN";
  }
};

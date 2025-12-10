import type { MonitorAdapter } from "../types.js";
import { httpAdapter } from "./monitor-http.js";
import { tcpAdapter } from "./monitor-tcp.js";
import { pingAdapter } from "./monitor-ping.js";
import { dnsAdapter } from "./monitor-dns.js";
import { dockerAdapter } from "./monitor-docker.js";
import { certificateAdapter } from "./monitor-certificate.js";
import { databaseAdapter } from "./monitor-database.js";
import { syntheticAdapter } from "./monitor-synthetic.js";
import { grpcAdapter } from "./monitor-grpc.js";
import { pushAdapter } from "./monitor-push.js";

export const buildDefaultAdapters = (): MonitorAdapter[] => [
  httpAdapter,
  tcpAdapter,
  pingAdapter,
  dnsAdapter,
  dockerAdapter,
  certificateAdapter,
  databaseAdapter,
  syntheticAdapter,
  grpcAdapter,
  pushAdapter,
];

export type MonitorKind =
  | "http"
  | "tcp"
  | "ping"
  | "dns"
  | "docker"
  | "certificate"
  | "database"
  | "synthetic"
  | "grpc"
  | "push";

export type StatusState = "up" | "down" | "pending";

export interface BaseMonitor {
  id: string;
  name: string;
  kind: MonitorKind;
  interval: number; // milliseconds
  timeout?: number;
  config: Record<string, unknown>;
  tags?: string[];
  groupId?: string;
  maintenanceWindowIds?: string[];
}

export interface MonitorResultMeta {
  latencyMs?: number;
  keywordMatched?: boolean;
  resolvedIp?: string;
  certificateExpiresAt?: string;
  certificateDaysLeft?: number;
  docker?: {
    containerId?: string;
    state?: string;
    image?: string;
    needsUpdate?: boolean;
  };
  dockerImageDigest?: string;
  dockerAvailableUpdates?: string[];
  dnsAnswers?: string[];
  dbVariant?: string;
  journeySteps?: Array<{ label: string; status: StatusState; detail?: string; screenshot?: string }>;
  grpcStatus?: string;
  pushWindowSeconds?: number;
  heartbeatReceivedAt?: string | null;
  maintenanceSuppressed?: boolean;
}

export interface MonitorResult {
  monitorId: string;
  status: StatusState;
  message: string;
  checkedAt: string;
  meta?: MonitorResultMeta;
}

export interface MonitorAdapter {
  kind: MonitorKind;
  supports(config: BaseMonitor["config"]): boolean;
  execute(monitor: BaseMonitor): Promise<MonitorResult>;
}

export interface HttpConfig {
  url: string;
  method?: string;
  headers?: Record<string, string | number | string[]>;
  body?: string;
  keyword?: string;
  expectStatus?: number;
  allowInsecure?: boolean;
}

export interface TcpConfig {
  host: string;
  port: number;
}

export interface PingConfig {
  host: string;
  packets?: number;
}

export interface DnsConfig {
  record: string;
  type?: "A" | "AAAA" | "TXT" | "CNAME" | "MX" | "NS";
  server?: string;
}

export interface DockerConfig {
  containerName: string;
  image?: string;
  socketPath?: string;
  registryImage?: string;
}

export interface CertificateConfig {
  host: string;
  port?: number;
  warningDays?: number;
}

export type DatabaseVariant = "postgres" | "mysql" | "mariadb" | "redis" | "mongodb";

export interface DatabaseConfig {
  variant: DatabaseVariant;
  connectionString: string;
  query?: string;
}

export interface SyntheticStep {
  action: "goto" | "click" | "fill" | "expect" | "wait";
  selector?: string;
  value?: string;
  text?: string;
  property?: string;
  url?: string;
  timeout?: number;
}

export interface SyntheticConfig {
  steps: SyntheticStep[];
  browser?: "chromium" | "firefox" | "webkit";
  baseUrl?: string;
  remoteBrowserId?: string; // ID of remote browser from settings
  useLocalBrowser?: boolean; // Force local browser usage
  ignoreHTTPSErrors?: boolean; // Ignore HTTPS/SSL certificate errors
}

export interface GrpcConfig {
  target: string;
  service?: string;
  deadline?: number;
}

export interface PushConfig {
  heartbeatSeconds: number;
  lastHeartbeatAt?: string;
}

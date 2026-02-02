import type { IncidentWithRelations, Monitor, NotificationChannel, StatusPage } from "@uptivalab/shared";
import { z } from "zod";
import { API_BASE } from "./config.js";

const jsonHeaders = { "Content-Type": "application/json" } as const;

const statusResponse = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    status: z.union([z.literal("up"), z.literal("down"), z.literal("pending"), z.literal("paused")]),
    lastCheck: z.string().nullable(),
    incident: z.any().nullable(),
  })
);

type FetchOptions = RequestInit & { token?: string | null };

const request = async <T>(path: string, options: FetchOptions = {}) => {
  const headers = new Headers(options.headers ?? {});
  if (!(options.body instanceof FormData)) {
    headers.set("Accept", "application/json");
  }
  if (options.token) {
    headers.set("Authorization", `Bearer ${options.token}`);
  }
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(body.message ?? `Request failed: ${response.status}`);
  }
  if (response.status === 204) return null as T;
  return (await response.json()) as T;
};

export const api = {
  listStatus: (token: string | null) => request<{ id: string; name: string; status: Monitor["status"]; lastCheck: string | null }[]>("/api/status", { token }),
  listMonitors: (token: string | null, page = 1, limit = 50) => request<{ data: Monitor[]; meta: { page: number; limit: number; total: number; totalPages: number } }>(`/api/monitors?page=${page}&limit=${limit}`, { token }),
  getMonitor: (token: string | null, id: string) => request<Monitor>(`/api/monitors/${id}`, { token }),
  createMonitor: (token: string | null, payload: Partial<Monitor> & { config: Record<string, unknown>; kind: string; notificationIds?: string[] }) =>
    request<Monitor>("/api/monitors", {
      method: "POST",
      token,
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    }),
  updateMonitor: (token: string | null, id: string, payload: Partial<Monitor>) =>
    request<Monitor>(`/api/monitors/${id}`, {
      method: "PUT",
      token,
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    }),
  deleteMonitor: (token: string | null, id: string) =>
    request<void>(`/api/monitors/${id}`, { method: "DELETE", token }),
  pauseMonitor: (token: string | null, id: string) =>
    request<Monitor>(`/api/monitors/${id}/pause`, { method: "POST", token }),
  resumeMonitor: (token: string | null, id: string) =>
    request<Monitor>(`/api/monitors/${id}/resume`, { method: "POST", token }),
  runMonitor: (token: string | null, id: string) =>
    request<{ message: string }>(`/api/monitors/${id}/run`, { method: "POST", token }),
  getMonitorHistory: (token: string | null, id: string, limit = 50, includePayload = false) =>
    request<{
      checks: Array<{ id: string; status: string; latencyMs: number | null; checkedAt: string; payload?: any }>;
      stats: { totalChecks: number; upChecks: number; downChecks: number; uptimePercentage: number; avgResponseTime: number | null };
    }>(`/api/monitors/${id}/history?limit=${limit}${includePayload ? '&includePayload=true' : ''}`, { token }),
  getMonitorScreenshots: (token: string | null, id: string) =>
    request<{
      checkId: string;
      checkedAt: string;
      status: string;
      screenshots: Array<{ id: string; stepLabel: string; stepIndex: number | null; capturedAt: string; data: string }>;
    }>(`/api/monitors/${id}/screenshots`, { token }),
  getCheckScreenshots: (token: string | null, monitorId: string, checkId: string) =>
    request<{
      checkId: string;
      checkedAt: string;
      status: string;
      screenshots: Array<{ id: string; stepLabel: string; capturedAt: string; data: string }>;
    }>(`/api/monitors/${monitorId}/checks/${checkId}/screenshots`, { token }),
  getMonitorUptime: (token: string | null, id: string, days = 30) =>
    request<{
      stats: { totalChecks: number; upChecks: number; downChecks: number; uptimePercentage: number; avgResponseTime: number | null };
      days: Array<{ date: string; uptimePercentage: number }>;
    }>(`/api/monitors/${id}/uptime?days=${days}`, { token }),
  listNotifications: (token: string | null, page = 1, limit = 20) => request<{ data: NotificationChannel[]; meta: { page: number; limit: number; total: number; totalPages: number } }>(`/api/notifications?page=${page}&limit=${limit}`, { token }),
  createNotification: (token: string | null, payload: { name: string; type: string; config: Record<string, string> }) =>
    request<NotificationChannel>("/api/notifications", {
      method: "POST",
      token,
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    }),
  updateNotification: (token: string | null, id: string, payload: { name: string; type: string; config: Record<string, string> }) =>
    request<NotificationChannel>(`/api/notifications/${id}`, {
      method: "PUT",
      token,
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    }),
  deleteNotification: (token: string | null, id: string) =>
    request<void>(`/api/notifications/${id}`, { method: "DELETE", token }),
  listIncidents: (token: string | null, page = 1, limit = 15) => request<{ data: IncidentWithRelations[]; meta: { page: number; limit: number; total: number; totalPages: number } }>(`/api/incidents?page=${page}&limit=${limit}`, { token }),
  updateIncidentStatus: (token: string | null, incidentId: string, status: string) =>
    request<IncidentWithRelations>(`/api/incidents/${incidentId}`, {
      method: "PATCH",
      token,
      headers: jsonHeaders,
      body: JSON.stringify({ status }),
    }),
  listStatusPages: (token: string | null) => request<StatusPage[]>("/api/status-pages", { token }),
  getStatusPage: (token: string | null, id: string) => request<StatusPage>(`/api/status-pages/${id}`, { token }),
  createStatusPage: (token: string | null, payload: { name: string; slug: string; heroMessage?: string; monitorIds?: string[] }) =>
    request<StatusPage>("/api/status-pages", {
      method: "POST",
      token,
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    }),
  updateStatusPage: (token: string | null, id: string, payload: Partial<{ name: string; slug: string; heroMessage?: string; monitorIds?: string[] }>) =>
    request<StatusPage>(`/api/status-pages/${id}`, {
      method: "PUT",
      token,
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    }),
  deleteStatusPage: (token: string | null, id: string) =>
    request<void>(`/api/status-pages/${id}`, { method: "DELETE", token }),
  getPublicStatusPage: (slug: string) =>
    request<{
      id: string;
      name: string;
      slug: string;
      overallStatus: string;
      monitors: Array<{ id: string; name: string; status: string; uptimePercentage: number; lastCheck: string | null }>;
    }>(`/api/public/status/${slug}`),
  fetchPublicStatus: (slug: string) => request(`/api/status/public/${slug}`),
  listMaintenance: (token: string | null, page = 1, limit = 20) => request<{ data: any[]; meta: { page: number; limit: number; total: number; totalPages: number } }>(`/api/maintenance?page=${page}&limit=${limit}`, { token }),
  createMaintenance: (token: string | null, payload: { name: string; startsAt: string; endsAt: string; monitorIds: string[] }) =>
    request("/api/maintenance", {
      method: "POST",
      token,
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    }),
  updateMaintenance: (token: string | null, id: string, payload: { name: string; startsAt: string; endsAt: string; monitorIds: string[] }) =>
    request(`/api/maintenance/${id}`, {
      method: "PUT",
      token,
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    }),
  deleteMaintenance: (token: string | null, id: string) =>
    request<void>(`/api/maintenance/${id}`, { method: "DELETE", token }),
  listHeartbeats: (token: string | null) =>
    request<Array<{ id: string; monitorId: string; tokenHash: string; heartbeatEvery: number; lastHeartbeat: string | null; monitor: Monitor }>>("/api/heartbeats", { token }),
  createHeartbeat: (token: string | null, payload: { monitorId: string; heartbeatEvery: number }) =>
    request<{ id: string; tokenHash: string; url: string; monitor: Monitor }>("/api/heartbeats", {
      method: "POST",
      token,
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    }),
  deleteHeartbeat: (token: string | null, id: string) =>
    request<void>(`/api/heartbeats/${id}`, { method: "DELETE", token }),
  getHeartbeatHistory: (token: string | null, id: string, days = 7) =>
    request<{
      heartbeat: { id: string; monitorId: string; monitorName: string; heartbeatEvery: number; lastHeartbeat: string | null };
      intervals: Array<{ timestamp: string; intervalSeconds: number; expectedSeconds: number; isLate: boolean; status: string }>;
      stats: { totalHeartbeats: number; missedHeartbeats: number; avgInterval: number };
    }>(`/api/heartbeats/${id}/history?days=${days}`, { token }),
  // Settings APIs
  changePassword: (token: string | null, payload: { currentPassword: string; newPassword: string }) =>
    request("/api/settings/change-password", {
      method: "POST",
      token,
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    }),
  listApiKeys: (token: string | null) => request<Array<{ id: string; label: string; createdAt: string; lastUsedAt: string | null }>>("/api/settings/api-keys", { token }),
  createApiKey: (token: string | null, payload: { label: string }) =>
    request<{ id: string; label: string; token: string; createdAt: string }>("/api/settings/api-keys", {
      method: "POST",
      token,
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    }),
  deleteApiKey: (token: string | null, id: string) =>
    request<void>(`/api/settings/api-keys/${id}`, { method: "DELETE", token }),
  listDockerHosts: (token: string | null) => request<Array<{ id: string; name: string; url: string; createdAt: string }>>("/api/settings/docker-hosts", { token }),
  createDockerHost: (token: string | null, payload: { name: string; url: string }) =>
    request<{ id: string; name: string; url: string; createdAt: string }>("/api/settings/docker-hosts", {
      method: "POST",
      token,
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    }),
  deleteDockerHost: (token: string | null, id: string) =>
    request<void>(`/api/settings/docker-hosts/${id}`, { method: "DELETE", token }),
  testDockerHost: (token: string | null, id: string) =>
    request<{ success: boolean; message: string; containers?: any[]; images?: any[] }>(`/api/settings/docker-hosts/${id}/test`, {
      method: "POST",
      token,
      headers: jsonHeaders,
      body: JSON.stringify({}),
    }),
  getDockerHostResources: (token: string | null, id: string) =>
    request<{ containers: any[]; images: any[] }>(`/api/settings/docker-hosts/${id}/resources`, { token }),
  listRemoteBrowsers: (token: string | null) => request<Array<{ id: string; name: string; url: string; createdAt: string }>>("/api/settings/remote-browsers", { token }),
  createRemoteBrowser: (token: string | null, payload: { name: string; url: string }) =>
    request<{ id: string; name: string; url: string; createdAt: string }>("/api/settings/remote-browsers", {
      method: "POST",
      token,
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    }),
  deleteRemoteBrowser: (token: string | null, id: string) =>
    request<void>(`/api/settings/remote-browsers/${id}`, { method: "DELETE", token }),
  testRemoteBrowser: (token: string | null, payload: { url: string }) =>
    request<{ success: boolean; message: string }>(`/api/settings/remote-browsers/test`, {
      method: "POST",
      token,
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    }),
  listProxies: (token: string | null) => request<Array<{ id: string; name: string; protocol: string; host: string; port: number; auth?: { username: string; password: string } }>>("/api/settings/proxies", { token }),
  createProxy: (token: string | null, payload: { name: string; protocol: string; host: string; port: number; auth?: { username: string; password: string } }) =>
    request<{ id: string; name: string; protocol: string; host: string; port: number; auth?: { username: string; password: string } }>("/api/settings/proxies", {
      method: "POST",
      token,
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    }),
  deleteProxy: (token: string | null, id: string) =>
    request<void>(`/api/settings/proxies/${id}`, { method: "DELETE", token }),
  batchUpdateSettings: (token: string | null, payload: Record<string, any>) =>
    request("/api/settings/batch", {
      method: "POST",
      token,
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    }),
  getLanguage: () => request<string>("/api/settings/language"),
  setLanguage: (token: string | null, language: string) =>
    request<{ language: string }>("/api/settings/language", {
      method: "PUT",
      token,
      headers: jsonHeaders,
      body: JSON.stringify({ language }),
    }),
  // Cloudflare Tunnel
  getCloudflareTunnelStatus: (token: string | null) =>
    request<{ running: boolean; installed: boolean }>("/api/cloudflare-tunnel/status", { token }),
  controlCloudflareTunnel: (token: string | null, action: string) =>
    request<{ success: boolean; message: string }>(`/api/cloudflare-tunnel/${action}`, {
      method: "POST",
      token,
      headers: jsonHeaders,
      body: JSON.stringify({}),
    }),
  // Users
  listUsers: (token: string | null) => request<Array<{ id: string; email: string; role: string; createdAt: string; updatedAt: string; _count?: { apiKeys: number } }>>("/api/users", { token }),
  createUser: (token: string | null, payload: { email: string; password: string; role: string }) =>
    request<{ id: string; email: string; role: string }>("/api/users", {
      method: "POST",
      token,
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    }),
  deleteUser: (token: string | null, id: string) =>
    request<void>(`/api/users/${id}`, { method: "DELETE", token }),
  updateUserRole: (token: string | null, id: string, role: string) =>
    request<{ id: string; email: string; role: string }>(`/api/users/${id}/role`, {
      method: "PUT",
      token,
      headers: jsonHeaders,
      body: JSON.stringify({ role }),
    }),
  // Invitations
  listInvitations: (token: string | null) => request<Array<{ id: string; email: string; token: string; role: string; expiresAt: string; createdAt: string; createdBy?: { email: string } }>>("/api/invitations", { token }),
  createInvitation: (token: string | null, payload: { email: string; role: string; expiresInDays?: number }) =>
    request<{ id: string; token: string; email: string; role: string; expiresAt: string }>("/api/invitations", {
      method: "POST",
      token,
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    }),
  deleteInvitation: (token: string | null, id: string) =>
    request<void>(`/api/invitations/${id}`, { method: "DELETE", token }),
  verifyInvitation: (token: string) =>
    request<{ email: string; role: string; expiresAt: string }>(`/api/invitations/verify/${token}`),
  acceptInvitation: (payload: { token: string; password: string }) =>
    request<{ token: string; user: { id: string; email: string; role: string } }>("/api/invitations/accept", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    }),
  // Other
  checkUpdates: (token: string | null) => request<{ current: string; latest: string; latestBeta?: string; updateAvailable: boolean; betaAvailable: boolean; releaseUrl?: string }>("/api/settings/check-updates", { token }),
  testNotification: (token: string | null, payload: { name: string; type: string; config: Record<string, any> }) =>
    request<{ success: boolean; message: string }>(`/api/notifications/test`, {
      method: "POST",
      token,
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    }),
  // Recorder
  recorderCodegen: (token: string | null, payload: { url: string; browser?: string }) =>
    request<{ command: string; instructions: string[]; note: string }>("/api/recorder/codegen", {
      method: "POST",
      token,
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    }),
  recorderParse: (token: string | null, payload: { code: string }) =>
    request<{ steps: any[] }>("/api/recorder/parse", {
      method: "POST",
      token,
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    }),
  // Settings export/import
  exportSettings: async (token: string | null, password?: string): Promise<string> => {
    const headers = new Headers();
    headers.set("Accept", "application/json");
    headers.set("Content-Type", "application/json");
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    
    const response = await fetch(`${API_BASE}/api/settings/export`, {
      method: "POST",
      headers,
      body: JSON.stringify({ encrypt: !!password, password }),
    });
    
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { message?: string };
      throw new Error(body.message ?? `Request failed: ${response.status}`);
    }
    
    return await response.text();
  },
  importSettings: (token: string | null, data: string, password?: string) =>
    request<{ success: boolean; message: string }>("/api/settings/import", {
      method: "POST",
      token,
      headers: jsonHeaders,
      body: JSON.stringify({ data, password }),
    }),
  // Embedded browser dependencies
  installEmbeddedDeps: (token: string | null) =>
    request<{ success: boolean; message: string; alreadyInstalled?: boolean; installed?: { systemDeps: boolean; browsers: boolean } }>("/api/monitors/install-embedded-deps", {
      method: "POST",
      token
    }),
  getEmbeddedDepsStatus: (token: string | null) =>
    request<{ installed: boolean; browsersInstalled: boolean; systemDepsInstalled: boolean }>("/api/monitors/embedded-deps-status", { token }),
};

export type StatusSummary = z.infer<typeof statusResponse>[number];

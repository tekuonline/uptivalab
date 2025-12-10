import type { IncidentWithRelations, Monitor, NotificationChannel, StatusPage } from "@uptivalab/shared";
import { z } from "zod";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8080";

const jsonHeaders = { "Content-Type": "application/json" } as const;

const statusResponse = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    status: z.union([z.literal("up"), z.literal("down"), z.literal("pending")]),
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
  listMonitors: (token: string | null) => request<Monitor[]>("/api/monitors", { token }),
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
  getMonitorHistory: (token: string | null, id: string, limit = 50) =>
    request<{
      checks: Array<{ id: string; status: string; latencyMs: number | null; checkedAt: string }>;
      stats: { totalChecks: number; upChecks: number; downChecks: number; uptimePercentage: number; avgResponseTime: number | null };
    }>(`/api/monitors/${id}/history?limit=${limit}`, { token }),
  getMonitorUptime: (token: string | null, id: string, days = 30) =>
    request<{
      days: Array<{ date: string; uptimePercentage: number; totalChecks: number; upChecks: number }>;
      overall: { totalChecks: number; upChecks: number; uptimePercentage: number };
    }>(`/api/monitors/${id}/uptime?days=${days}`, { token }),
  listNotifications: (token: string | null) => request<NotificationChannel[]>("/api/notifications", { token }),
  createNotification: (token: string | null, payload: { name: string; type: string; config: Record<string, string> }) =>
    request<NotificationChannel>("/api/notifications", {
      method: "POST",
      token,
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    }),
  deleteNotification: (token: string | null, id: string) =>
    request<void>(`/api/notifications/${id}`, { method: "DELETE", token }),
  listIncidents: (token: string | null) => request<IncidentWithRelations[]>("/api/incidents", { token }),
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
  listMaintenance: (token: string | null) => request<any[]>("/api/maintenance", { token }),
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
};

export type StatusSummary = z.infer<typeof statusResponse>[number];

import { z } from "zod";
const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8080";
const jsonHeaders = { "Content-Type": "application/json" };
const statusResponse = z.array(z.object({
    id: z.string(),
    name: z.string(),
    status: z.union([z.literal("up"), z.literal("down"), z.literal("pending")]),
    lastCheck: z.string().nullable(),
    incident: z.any().nullable(),
}));
const request = async (path, options = {}) => {
    const headers = new Headers(options.headers ?? {});
    if (!(options.body instanceof FormData)) {
        headers.set("Accept", "application/json");
    }
    if (options.token) {
        headers.set("Authorization", `Bearer ${options.token}`);
    }
    const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
    if (!response.ok) {
        const body = (await response.json().catch(() => ({})));
        throw new Error(body.message ?? `Request failed: ${response.status}`);
    }
    if (response.status === 204)
        return null;
    return (await response.json());
};
export const api = {
    listStatus: (token) => request("/api/status", { token }),
    listMonitors: (token) => request("/api/monitors", { token }),
    getMonitor: (token, id) => request(`/api/monitors/${id}`, { token }),
    createMonitor: (token, payload) => request("/api/monitors", {
        method: "POST",
        token,
        headers: jsonHeaders,
        body: JSON.stringify(payload),
    }),
    updateMonitor: (token, id, payload) => request(`/api/monitors/${id}`, {
        method: "PUT",
        token,
        headers: jsonHeaders,
        body: JSON.stringify(payload),
    }),
    deleteMonitor: (token, id) => request(`/api/monitors/${id}`, { method: "DELETE", token }),
    pauseMonitor: (token, id) => request(`/api/monitors/${id}/pause`, { method: "POST", token }),
    resumeMonitor: (token, id) => request(`/api/monitors/${id}/resume`, { method: "POST", token }),
    getMonitorHistory: (token, id, limit = 50) => request(`/api/monitors/${id}/history?limit=${limit}`, { token }),
    getMonitorUptime: (token, id, days = 30) => request(`/api/monitors/${id}/uptime?days=${days}`, { token }),
    listNotifications: (token) => request("/api/notifications", { token }),
    createNotification: (token, payload) => request("/api/notifications", {
        method: "POST",
        token,
        headers: jsonHeaders,
        body: JSON.stringify(payload),
    }),
    deleteNotification: (token, id) => request(`/api/notifications/${id}`, { method: "DELETE", token }),
    listIncidents: (token) => request("/api/incidents", { token }),
    updateIncidentStatus: (token, incidentId, status) => request(`/api/incidents/${incidentId}`, {
        method: "PATCH",
        token,
        headers: jsonHeaders,
        body: JSON.stringify({ status }),
    }),
    listStatusPages: (token) => request("/api/status-pages", { token }),
    getStatusPage: (token, id) => request(`/api/status-pages/${id}`, { token }),
    createStatusPage: (token, payload) => request("/api/status-pages", {
        method: "POST",
        token,
        headers: jsonHeaders,
        body: JSON.stringify(payload),
    }),
    updateStatusPage: (token, id, payload) => request(`/api/status-pages/${id}`, {
        method: "PUT",
        token,
        headers: jsonHeaders,
        body: JSON.stringify(payload),
    }),
    deleteStatusPage: (token, id) => request(`/api/status-pages/${id}`, { method: "DELETE", token }),
    getPublicStatusPage: (slug) => request(`/api/public/status/${slug}`),
    fetchPublicStatus: (slug) => request(`/api/status/public/${slug}`),
    listMaintenance: (token) => request("/api/maintenance", { token }),
    createMaintenance: (token, payload) => request("/api/maintenance", {
        method: "POST",
        token,
        headers: jsonHeaders,
        body: JSON.stringify(payload),
    }),
    updateMaintenance: (token, id, payload) => request(`/api/maintenance/${id}`, {
        method: "PUT",
        token,
        headers: jsonHeaders,
        body: JSON.stringify(payload),
    }),
    deleteMaintenance: (token, id) => request(`/api/maintenance/${id}`, { method: "DELETE", token }),
    listHeartbeats: (token) => request("/api/heartbeats", { token }),
    createHeartbeat: (token, payload) => request("/api/heartbeats", {
        method: "POST",
        token,
        headers: jsonHeaders,
        body: JSON.stringify(payload),
    }),
    deleteHeartbeat: (token, id) => request(`/api/heartbeats/${id}`, { method: "DELETE", token }),
    getHeartbeatHistory: (token, id, days = 7) => request(`/api/heartbeats/${id}/history?days=${days}`, { token }),
};

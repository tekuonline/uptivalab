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
    createMonitor: (token, payload) => request("/api/monitors", {
        method: "POST",
        token,
        headers: jsonHeaders,
        body: JSON.stringify(payload),
    }),
    listNotifications: (token) => request("/api/notifications", { token }),
    listIncidents: (token) => request("/api/incidents", { token }),
    listStatusPages: (token) => request("/api/status-pages", { token }),
    fetchPublicStatus: (slug) => request(`/api/status/public/${slug}`),
    listMaintenance: (token) => request("/api/maintenance", { token }),
};

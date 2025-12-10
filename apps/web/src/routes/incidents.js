import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { api } from "../lib/api.js";
import { Card } from "../components/ui/card.js";
import { StatusBadge } from "../components/status-badge.js";
import { useAuth } from "../providers/auth-context.js";
const badgeStatus = (incident) => (incident.status === "RESOLVED" ? "up" : "down");
const latestMessage = (incident) => incident.events?.[0]?.message ?? "No updates yet.";
export const IncidentsRoute = () => {
    const { token } = useAuth();
    const { data, isLoading } = useQuery({ queryKey: ["incidents"], queryFn: () => api.listIncidents(token), enabled: Boolean(token) });
    if (isLoading)
        return _jsx("p", { className: "text-slate-400", children: "Loading incidents\u2026" });
    return (_jsxs(Card, { children: [_jsx("h3", { className: "mb-4 text-xl font-semibold text-white", children: "Incidents" }), _jsxs("div", { className: "space-y-4", children: [data?.map((incident) => (_jsxs("div", { className: "rounded-2xl border border-white/10 bg-white/5 p-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("p", { className: "text-lg font-semibold text-white", children: incident.monitor?.name ?? incident.monitorId }), _jsx("p", { className: "text-sm text-slate-400", children: latestMessage(incident) })] }), _jsx(StatusBadge, { status: badgeStatus(incident) })] }), _jsxs("p", { className: "mt-2 text-xs uppercase tracking-[0.3em] text-slate-500", children: ["Started ", format(new Date(incident.startedAt), "PPpp")] })] }, incident.id))), (data?.length ?? 0) === 0 && _jsx("p", { className: "text-sm text-slate-400", children: "No incidents logged." })] })] }));
};

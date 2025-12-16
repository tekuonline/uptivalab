import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Filter, Clock, AlertCircle } from "lucide-react";
import { api } from "../lib/api.js";
import { Card } from "../components/ui/card.js";
import { Button } from "../components/ui/button.js";
import { StatusBadge } from "../components/status-badge.js";
import { useAuth } from "../providers/auth-context.js";
import { useTranslation } from "../hooks/use-translation.js";
const badgeStatus = (incident) => (incident.status === "RESOLVED" ? "up" : "down");
const statusColors = {
    OPEN: "bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/30",
    INVESTIGATING: "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border-yellow-500/30",
    MITIGATED: "bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30",
    RESOLVED: "bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/30",
};
export const IncidentsRoute = () => {
    const { t } = useTranslation();
    const { token } = useAuth();
    const queryClient = useQueryClient();
    const latestMessage = (incident) => incident.events?.[0]?.message ?? t("noUpdatesYet");
    const { data: incidents, isLoading } = useQuery({ queryKey: ["incidents"], queryFn: () => api.listIncidents(token), enabled: Boolean(token) });
    const { data: monitors } = useQuery({ queryKey: ["monitors"], queryFn: () => api.listMonitors(token), enabled: Boolean(token) });
    const [filters, setFilters] = useState({
        status: "all",
        monitorId: "all",
    });
    const [sortBy, setSortBy] = useState("date");
    const [selectedIncident, setSelectedIncident] = useState(null);
    const filteredIncidents = useMemo(() => {
        if (!incidents)
            return [];
        let filtered = [...incidents];
        // Apply filters
        if (filters.status !== "all") {
            filtered = filtered.filter((inc) => inc.status === filters.status);
        }
        if (filters.monitorId !== "all") {
            filtered = filtered.filter((inc) => inc.monitorId === filters.monitorId);
        }
        // Apply sorting
        if (sortBy === "date") {
            filtered.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
        }
        else if (sortBy === "duration") {
            filtered.sort((a, b) => {
                const aDuration = a.resolvedAt ? new Date(a.resolvedAt).getTime() - new Date(a.startedAt).getTime() : Date.now() - new Date(a.startedAt).getTime();
                const bDuration = b.resolvedAt ? new Date(b.resolvedAt).getTime() - new Date(b.startedAt).getTime() : Date.now() - new Date(b.startedAt).getTime();
                return bDuration - aDuration;
            });
        }
        return filtered;
    }, [incidents, filters, sortBy]);
    const updateStatusMutation = useMutation({
        mutationFn: async ({ incidentId, newStatus }) => {
            return api.updateIncidentStatus(token, incidentId, newStatus);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["incidents"] });
            setSelectedIncident(null);
        },
    });
    if (isLoading)
        return _jsx("p", { className: "text-slate-400", children: t("loading") });
    return (_jsxs("div", { className: "space-y-6", children: [_jsx(Card, { children: _jsxs("div", { className: "flex flex-wrap items-center gap-4", children: [_jsxs("div", { className: "flex items-center gap-2 text-slate-900 dark:text-white", children: [_jsx(Filter, { className: "h-4 w-4" }), _jsxs("span", { className: "text-sm font-medium", children: [t("filters"), ":"] })] }), _jsxs("select", { className: "rounded-lg border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-3 py-2 text-sm text-slate-900 dark:text-slate-900 dark:text-white h-[42px]", value: filters.status, onChange: (e) => setFilters({ ...filters, status: e.target.value }), children: [_jsx("option", { value: "all", children: t("allStatuses") }), _jsx("option", { value: "OPEN", children: t("open") }), _jsx("option", { value: "INVESTIGATING", children: t("investigating") }), _jsx("option", { value: "MITIGATED", children: t("mitigated") }), _jsx("option", { value: "RESOLVED", children: t("resolved") })] }), _jsxs("select", { className: "rounded-lg border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-3 py-2 text-sm text-slate-900 dark:text-slate-900 dark:text-white h-[42px]", value: filters.monitorId, onChange: (e) => setFilters({ ...filters, monitorId: e.target.value }), children: [_jsx("option", { value: "all", children: t("allMonitors") }), monitors?.map((m) => (_jsx("option", { value: m.id, children: m.name }, m.id)))] }), _jsxs("select", { className: "rounded-lg border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-3 py-2 text-sm text-slate-900 dark:text-slate-900 dark:text-white h-[42px]", value: sortBy, onChange: (e) => setSortBy(e.target.value), children: [_jsxs("option", { value: "date", children: [t("sortBy"), " ", t("date")] }), _jsxs("option", { value: "duration", children: [t("sortBy"), " ", t("duration")] })] })] }) }), _jsxs("div", { className: "space-y-4", children: [filteredIncidents.map((incident) => {
                        const duration = incident.resolvedAt
                            ? Math.round((new Date(incident.resolvedAt).getTime() - new Date(incident.startedAt).getTime()) / 1000 / 60)
                            : Math.round((Date.now() - new Date(incident.startedAt).getTime()) / 1000 / 60);
                        return (_jsx(Card, { className: "hover:border-white/20 transition cursor-pointer", children: _jsxs("div", { className: "flex items-start justify-between gap-4", children: [_jsxs("div", { className: "flex-1", children: [_jsxs("div", { className: "flex items-center gap-3 mb-2", children: [_jsx("h4", { className: "text-lg font-semibold text-slate-900 dark:text-white", children: incident.monitor?.name ?? incident.monitorId }), _jsx("span", { className: `px-3 py-1 rounded-full text-xs font-medium border ${statusColors[incident.status]}`, children: incident.status })] }), _jsx("p", { className: "text-sm text-slate-600 dark:text-slate-400 mb-3", children: latestMessage(incident) }), _jsxs("div", { className: "flex items-center gap-6 text-xs text-slate-500", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Clock, { className: "h-3 w-3" }), t("date"), " ", incident.startedAt ? format(new Date(incident.startedAt), "PPp") : "Unknown"] }), incident.resolvedAt && (_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(AlertCircle, { className: "h-3 w-3" }), t("resolved"), " ", format(new Date(incident.resolvedAt), "PPp")] })), _jsxs("div", { className: "font-medium text-slate-900 dark:text-white", children: [t("duration"), ": ", duration < 60 ? `${duration}m` : `${Math.floor(duration / 60)}h ${duration % 60}m`] })] }), incident.events && incident.events.length > 0 && (_jsx("div", { className: "mt-4 space-y-2 pl-4 border-l-2 border-white/10", children: incident.events.slice(0, 3).map((event, idx) => (_jsxs("div", { className: "text-xs", children: [_jsx("span", { className: "text-slate-500", children: event.timestamp ? format(new Date(event.timestamp), "HH:mm:ss") : "N/A" }), _jsx("span", { className: "ml-2 text-slate-400", children: event.message })] }, idx))) }))] }), _jsxs("div", { className: "flex flex-col gap-2", children: [_jsx(StatusBadge, { status: badgeStatus(incident) }), incident.status !== "RESOLVED" && (_jsx(Button, { variant: "ghost", onClick: () => setSelectedIncident(incident), className: "text-xs px-2 py-1", children: t("updateStatus") }))] })] }) }, incident.id));
                    }), filteredIncidents.length === 0 && (_jsx(Card, { children: _jsx("p", { className: "text-center text-slate-400", children: t("noIncidents") }) }))] }), selectedIncident && (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/50", children: _jsxs(Card, { className: "max-w-md w-full mx-4", children: [_jsx("h3", { className: "text-xl font-semibold text-slate-900 dark:text-slate-900 dark:text-white mb-4", children: t("updateStatus") }), _jsx("p", { className: "text-sm text-slate-600 dark:text-slate-400 mb-4", children: selectedIncident.monitor?.name }), _jsx("div", { className: "space-y-2", children: ["INVESTIGATING", "MITIGATED", "RESOLVED"].map((status) => (_jsx(Button, { variant: "secondary", className: "w-full", onClick: () => {
                                    updateStatusMutation.mutate({ incidentId: selectedIncident.id, newStatus: status });
                                }, children: t(status.toLowerCase()) }, status))) }), _jsx(Button, { variant: "ghost", className: "w-full mt-4", onClick: () => setSelectedIncident(null), children: t("cancel") })] }) }))] }));
};

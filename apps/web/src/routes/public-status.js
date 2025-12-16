import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api.js";
import { useTranslation } from "../lib/i18n.js";
import { Card } from "../components/ui/card.js";
import { StatusBadge } from "../components/status-badge.js";
import { format } from "date-fns";
import { CheckCircle, XCircle, Clock, AlertTriangle, Wrench } from "lucide-react";
import { useEffect } from "react";
export const PublicStatusRoute = () => {
    const { t } = useTranslation();
    const { slug } = useParams();
    const { data, isLoading, error } = useQuery({
        queryKey: ["public-status", slug],
        queryFn: () => api.getPublicStatusPage(slug),
        enabled: Boolean(slug),
        refetchInterval: 30000, // Refresh every 30s
    });
    // Apply theme based on status page settings
    useEffect(() => {
        if (!data)
            return;
        const theme = data.theme || "system";
        const root = document.documentElement;
        if (theme === "light") {
            root.classList.remove("dark");
            root.classList.add("light");
        }
        else if (theme === "dark") {
            root.classList.remove("light");
            root.classList.add("dark");
        }
        else {
            // System theme
            root.classList.remove("light", "dark");
            if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
                root.classList.add("dark");
            }
            else {
                root.classList.add("light");
            }
        }
        // Cleanup on unmount - restore user's theme preference
        return () => {
            root.classList.remove("light", "dark");
        };
    }, [data]);
    if (isLoading) {
        return (_jsx("div", { className: "min-h-screen bg-background flex items-center justify-center", children: _jsx("p", { className: "text-slate-600 dark:text-slate-400", children: "Loading status page..." }) }));
    }
    if (error || !data) {
        return (_jsx("div", { className: "min-h-screen bg-background flex items-center justify-center", children: _jsxs(Card, { className: "max-w-md text-center", children: [_jsx(XCircle, { className: "h-12 w-12 text-red-500 mx-auto mb-4" }), _jsx("h1", { className: "text-2xl font-bold text-slate-900 dark:text-white mb-2", children: "Status Page Not Found" }), _jsx("p", { className: "text-slate-600 dark:text-slate-400", children: "The status page you're looking for doesn't exist." })] }) }));
    }
    const getStatusColor = (status) => {
        switch (status) {
            case "operational": return "text-green-500";
            case "degraded": return "text-yellow-500";
            case "down": return "text-red-500";
            default: return "text-slate-500";
        }
    };
    const getStatusIcon = (status) => {
        switch (status) {
            case "operational": return _jsx(CheckCircle, { className: "h-6 w-6 text-green-500" });
            case "degraded": return _jsx(Clock, { className: "h-6 w-6 text-yellow-500" });
            case "down": return _jsx(XCircle, { className: "h-6 w-6 text-red-500" });
            default: return _jsx(Clock, { className: "h-6 w-6 text-slate-500" });
        }
    };
    return (_jsx("div", { className: "min-h-screen bg-background py-12 px-4", children: _jsxs("div", { className: "max-w-4xl mx-auto space-y-8", children: [_jsxs("div", { className: "text-center space-y-4", children: [_jsx("h1", { className: "text-4xl font-bold text-slate-900 dark:text-white", children: data.name }), _jsxs("div", { className: "flex items-center justify-center gap-3", children: [getStatusIcon(data.overallStatus), _jsxs("span", { className: `text-2xl font-semibold ${getStatusColor(data.overallStatus)}`, children: [data.overallStatus === "operational" && t("allSystemsOperational"), data.overallStatus === "degraded" && t("partialSystemOutage"), data.overallStatus === "down" && t("majorOutage")] })] }), _jsxs("p", { className: "text-sm text-slate-600 dark:text-slate-400", children: ["Last updated: ", format(new Date(), "MMM dd, yyyy HH:mm:ss")] })] }), _jsxs("div", { className: "space-y-4", children: [_jsx("h2", { className: "text-xl font-semibold text-slate-900 dark:text-white", children: "Services" }), data.monitors.map((monitor) => (_jsxs(Card, { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex-1", children: [_jsx("h3", { className: "text-lg font-semibold text-slate-900 dark:text-white", children: monitor.name }), monitor.lastCheck && (_jsxs("p", { className: "text-xs text-slate-600 dark:text-slate-500", children: ["Last checked: ", format(new Date(monitor.lastCheck), "MMM dd, HH:mm:ss")] }))] }), _jsxs("div", { className: "flex items-center gap-4", children: [_jsxs("div", { className: "text-right", children: [_jsxs("p", { className: "text-sm font-semibold text-slate-900 dark:text-white", children: [monitor.uptimePercentage.toFixed(2), "%"] }), _jsx("p", { className: "text-xs text-slate-600 dark:text-slate-400", children: "Uptime" })] }), monitor.kind === "certificate" && monitor.meta?.certificateDaysLeft !== undefined && (_jsxs("div", { className: "text-right", children: [_jsxs("p", { className: `text-sm font-semibold ${monitor.meta.certificateDaysLeft < 7
                                                        ? 'text-red-600 dark:text-red-400'
                                                        : monitor.meta.certificateDaysLeft < 30
                                                            ? 'text-yellow-600 dark:text-yellow-400'
                                                            : 'text-green-600 dark:text-green-400'}`, children: ["\uD83D\uDD12 ", monitor.meta.certificateDaysLeft, "d"] }), _jsx("p", { className: "text-xs text-slate-600 dark:text-slate-400", children: "Cert Expiry" })] })), _jsx(StatusBadge, { status: monitor.status })] })] }, monitor.id))), data.monitors.length === 0 && (_jsx("p", { className: "text-center text-slate-600 dark:text-slate-400 py-8", children: "No services configured yet." }))] }), data.showIncidents && data.monitors.some((m) => m.incidents && m.incidents.length > 0) && (_jsxs("div", { className: "space-y-4", children: [_jsxs("h2", { className: "text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-2", children: [_jsx(AlertTriangle, { className: "h-5 w-5 text-yellow-500" }), "Active Incidents"] }), data.monitors.map((monitor) => monitor.incidents?.map((incident) => (_jsx(Card, { className: "border-l-4 border-red-500", children: _jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "flex items-start justify-between", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-lg font-semibold text-slate-900 dark:text-white", children: monitor.name }), _jsxs("p", { className: "text-sm text-slate-600 dark:text-slate-400", children: ["Started ", format(new Date(incident.startedAt), "MMM dd, yyyy HH:mm")] })] }), _jsx("span", { className: `px-3 py-1 rounded-full text-xs font-semibold ${incident.status === 'OPEN' ? 'bg-red-500/20 text-red-400' :
                                                    incident.status === 'INVESTIGATING' ? 'bg-yellow-500/20 text-yellow-400' :
                                                        incident.status === 'MITIGATED' ? 'bg-blue-500/20 text-blue-400' :
                                                            'bg-green-500/20 text-green-400'}`, children: incident.status })] }), incident.events && incident.events.length > 0 && (_jsx("div", { className: "mt-3 space-y-2 border-t border-slate-200 dark:border-white/10 pt-3", children: incident.events.map((event) => (_jsxs("div", { className: "text-sm", children: [_jsx("p", { className: "text-slate-900 dark:text-white", children: event.message }), _jsx("p", { className: "text-xs text-slate-600 dark:text-slate-500", children: format(new Date(event.createdAt), "MMM dd, HH:mm") })] }, event.id))) }))] }) }, incident.id))))] })), data.showMaintenance && data.upcomingMaintenance && data.upcomingMaintenance.length > 0 && (_jsxs("div", { className: "space-y-4", children: [_jsxs("h2", { className: "text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-2", children: [_jsx(Wrench, { className: "h-5 w-5 text-blue-500" }), "Scheduled Maintenance"] }), data.upcomingMaintenance.map((maintenance) => {
                            const isActive = new Date(maintenance.startsAt) <= new Date() && new Date() <= new Date(maintenance.endsAt);
                            const isPast = new Date() > new Date(maintenance.endsAt);
                            return (_jsx(Card, { className: `border-l-4 ${isActive ? 'border-yellow-500' : 'border-blue-500'}`, children: _jsx("div", { className: "space-y-2", children: _jsxs("div", { className: "flex items-start justify-between", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-lg font-semibold text-slate-900 dark:text-white", children: maintenance.name }), _jsxs("p", { className: "text-sm text-slate-600 dark:text-slate-400", children: [format(new Date(maintenance.startsAt), "MMM dd, yyyy HH:mm"), " \u2192 ", format(new Date(maintenance.endsAt), "MMM dd, yyyy HH:mm")] }), maintenance.monitors && maintenance.monitors.length > 0 && (_jsxs("p", { className: "text-xs text-slate-600 dark:text-slate-500 mt-1", children: ["Affects: ", maintenance.monitors.map((m) => m.name).join(", ")] }))] }), isActive && (_jsx("span", { className: "px-3 py-1 rounded-full text-xs font-semibold bg-yellow-500/20 text-yellow-400", children: "IN PROGRESS" })), !isActive && !isPast && (_jsx("span", { className: "px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-400", children: "SCHEDULED" }))] }) }) }, maintenance.id));
                        })] })), _jsx("div", { className: "text-center pt-8 border-t border-slate-200 dark:border-white/10", children: _jsx("p", { className: "text-xs text-slate-600 dark:text-slate-500", children: "Powered by UptivaLab" }) })] }) }));
};

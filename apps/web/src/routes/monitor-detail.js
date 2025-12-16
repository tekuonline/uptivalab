import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Line as LineChart, Doughnut as DoughnutChart } from "react-chartjs-2";
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, ArcElement, Title, Tooltip, Legend, Filler, } from "chart.js";
import { api } from "../lib/api.js";
import { useAuth } from "../providers/auth-context.js";
import { useTranslation } from "../lib/i18n.js";
import { Card } from "../components/ui/card.js";
import { Button } from "../components/ui/button.js";
import { StatusBadge } from "../components/status-badge.js";
import { UptimeBar } from "../components/uptime-bar.js";
import { format } from "date-fns";
import { ArrowLeft, Edit2, Trash2, Pause, Play } from "lucide-react";
// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, ArcElement, Title, Tooltip, Legend, Filler);
export const MonitorDetailRoute = () => {
    const { t } = useTranslation();
    const { id } = useParams();
    const { token } = useAuth();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({
        name: "",
        interval: 60000,
        // Type-specific fields
        url: "",
        host: "",
        port: "",
        record: "",
        recordType: "A",
        containerName: "",
        connectionString: "",
        variant: "postgres",
        target: "",
        heartbeatSeconds: "300",
    });
    const { data: monitor } = useQuery({
        queryKey: ["monitor", id],
        queryFn: () => api.getMonitor(token, id),
        enabled: Boolean(token && id),
    });
    const { data: history } = useQuery({
        queryKey: ["monitor-history", id],
        queryFn: () => api.getMonitorHistory(token, id, 100),
        enabled: Boolean(token && id),
        refetchInterval: 30000, // Refresh every 30s
    });
    const { data: uptime } = useQuery({
        queryKey: ["monitor-uptime", id],
        queryFn: () => api.getMonitorUptime(token, id, 30),
        enabled: Boolean(token && id),
        refetchInterval: 30000,
    });
    const deleteMutation = useMutation({
        mutationFn: () => api.deleteMonitor(token, id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["monitors"] });
            navigate("/monitors");
        },
    });
    const pauseMutation = useMutation({
        mutationFn: () => api.pauseMonitor(token, id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["monitor", id] });
            queryClient.invalidateQueries({ queryKey: ["monitors"] });
        },
    });
    const resumeMutation = useMutation({
        mutationFn: () => api.resumeMonitor(token, id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["monitor", id] });
            queryClient.invalidateQueries({ queryKey: ["monitors"] });
        },
    });
    const updateMutation = useMutation({
        mutationFn: (payload) => api.updateMonitor(token, id, payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["monitor", id] });
            queryClient.invalidateQueries({ queryKey: ["monitors"] });
            setIsEditing(false);
        },
    });
    const handleEdit = () => {
        // Navigate to monitors page with edit state
        navigate('/monitors', { state: { editMonitor: monitor } });
    };
    const buildConfig = (formData, monitorKind) => {
        switch (monitorKind) {
            case "tcp":
                return { host: formData.host, port: parseInt(formData.port, 10) };
            case "ping":
                return { host: formData.host };
            case "dns":
                return { record: formData.record, type: formData.recordType };
            case "docker":
                return { containerName: formData.containerName };
            case "certificate":
                return { host: formData.host, port: parseInt(formData.port, 10) || 443 };
            case "database":
                return { variant: formData.variant, connectionString: formData.connectionString };
            case "grpc":
                return { target: formData.target };
            case "push":
                return { heartbeatSeconds: parseInt(formData.heartbeatSeconds, 10) };
            case "http":
            default:
                return { url: formData.url };
        }
    };
    const handleSave = () => {
        if (!monitor)
            return;
        const config = buildConfig(editForm, monitor.kind);
        updateMutation.mutate({
            name: editForm.name,
            config,
            interval: editForm.interval,
        });
    };
    const handleDelete = () => {
        if (confirm(`${t("areYouSureDelete")} "${monitor?.name}"?`)) {
            deleteMutation.mutate();
        }
    };
    // Prepare data for latency chart - filter out null/zero latency values
    const latencyData = history?.checks
        .filter((check) => check.latencyMs != null && check.latencyMs > 0)
        .map((check) => ({
        time: format(new Date(check.checkedAt), "HH:mm"),
        latency: check.latencyMs,
        status: check.status,
    })) ?? [];
    // Prepare data for uptime chart
    const uptimeData = uptime?.days
        .filter((day) => day.uptimePercentage != null)
        .map((day) => ({
        date: format(new Date(day.date), "MM/dd"),
        uptime: day.uptimePercentage,
    })) ?? [];
    if (!monitor)
        return _jsx("div", { className: "text-white", children: t("loading") });
    // Handle different monitor types - DNS monitors use 'record', others use 'url'
    const monitorConfig = monitor.config || {};
    const monitorUrl = monitorConfig.url || monitorConfig.record || t("na");
    const monitorType = monitor.kind || "http";
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-4", children: [_jsx(Link, { to: "/monitors", children: _jsxs(Button, { variant: "ghost", children: [_jsx(ArrowLeft, { className: "h-4 w-4 mr-2" }), t("back")] }) }), _jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-bold text-slate-900 dark:text-white", children: monitor.name }), _jsxs("div", { className: "flex items-center gap-2 mt-1", children: [_jsx("span", { className: "text-xs uppercase px-2 py-1 rounded bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30", children: monitorType }), _jsx("p", { className: "text-sm text-slate-600 dark:text-slate-400", children: monitorUrl }), monitorType === 'certificate' && monitor.meta?.certificateDaysLeft && (_jsxs("span", { className: `text-sm font-semibold px-3 py-1 rounded-full ${monitor.meta.certificateDaysLeft < 7
                                                    ? 'bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30'
                                                    : monitor.meta.certificateDaysLeft < 30
                                                        ? 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border border-yellow-500/30'
                                                        : 'bg-green-500/20 text-green-600 dark:text-green-400 border border-green-500/30'}`, children: ["\uD83D\uDD12 ", t("expiresInDays").replace("{days}", String(monitor.meta.certificateDaysLeft)).replace("{date}", new Date(monitor.meta.certificateExpiresAt).toLocaleDateString())] }))] })] })] }), _jsxs("div", { className: "flex gap-2", children: [_jsx(StatusBadge, { status: monitor.status ?? "pending" }), !isEditing && (_jsxs(_Fragment, { children: [monitor.paused ? (_jsxs(Button, { variant: "ghost", onClick: () => resumeMutation.mutate(), disabled: resumeMutation.isPending, children: [_jsx(Play, { className: "h-4 w-4 mr-2" }), resumeMutation.isPending ? t("loading") : t("resume")] })) : (_jsxs(Button, { variant: "ghost", onClick: () => pauseMutation.mutate(), disabled: pauseMutation.isPending, children: [_jsx(Pause, { className: "h-4 w-4 mr-2" }), pauseMutation.isPending ? t("loading") : t("pause")] })), _jsxs(Button, { variant: "ghost", onClick: handleEdit, children: [_jsx(Edit2, { className: "h-4 w-4 mr-2" }), t("edit")] }), _jsxs(Button, { variant: "ghost", onClick: handleDelete, disabled: deleteMutation.isPending, children: [_jsx(Trash2, { className: "h-4 w-4 mr-2" }), t("delete")] })] }))] })] }), monitor.kind === "push" && monitor.heartbeats && (_jsx(Card, { className: "border-2 border-blue-500/30 bg-blue-50 dark:bg-blue-500/5", children: _jsx("div", { className: "space-y-4", children: _jsxs("div", { className: "flex items-start gap-3", children: [_jsx("div", { className: "text-2xl", children: "\uD83E\uDEC0" }), _jsxs("div", { className: "flex-1", children: [_jsx("h3", { className: "text-xl font-semibold text-slate-900 dark:text-white mb-2", children: "Heartbeat URL" }), _jsxs("p", { className: "text-sm text-slate-600 dark:text-slate-300 mb-4", children: ["Send a POST request to this URL every ", _jsxs("strong", { className: "text-slate-900 dark:text-white", children: [monitor.heartbeats.heartbeatEvery, " seconds"] }), " from your application, cron job, or script. If we don't receive a heartbeat within the expected interval, we'll mark this monitor as down and send alerts."] }), _jsxs("div", { className: "rounded-lg bg-slate-900 dark:bg-slate-900 p-4 mb-4", children: [_jsxs("div", { className: "flex items-center justify-between mb-2", children: [_jsx("span", { className: "text-xs font-semibold text-slate-400 uppercase", children: "Heartbeat Endpoint" }), _jsx("button", { onClick: () => {
                                                            const url = `${window.location.origin}/api/heartbeat/${monitor.heartbeats.tokenHash}`;
                                                            navigator.clipboard.writeText(url);
                                                        }, className: "text-xs text-blue-400 hover:text-blue-300 transition", children: "\uD83D\uDCCB Copy" })] }), _jsxs("code", { className: "text-sm text-green-400 dark:text-green-400 break-all", children: [window.location.origin, "/api/heartbeat/", monitor.heartbeats.tokenHash] })] }), _jsxs("div", { className: "space-y-3", children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs font-semibold text-slate-400 uppercase mb-2", children: "Example: cURL" }), _jsx("div", { className: "rounded-lg bg-slate-900 p-3", children: _jsxs("code", { className: "text-xs text-slate-300 break-all", children: ["curl -X POST ", window.location.origin, "/api/heartbeat/", monitor.heartbeats.tokenHash] }) })] }), _jsxs("div", { children: [_jsx("p", { className: "text-xs font-semibold text-slate-400 uppercase mb-2", children: "Example: Cron Job" }), _jsx("div", { className: "rounded-lg bg-slate-900 p-3", children: _jsxs("code", { className: "text-xs text-slate-300", children: ["*/5 * * * * curl -X POST ", window.location.origin, "/api/heartbeat/", monitor.heartbeats.tokenHash] }) }), _jsx("p", { className: "text-xs text-slate-400 mt-1", children: "Sends a heartbeat every 5 minutes" })] }), _jsxs("div", { children: [_jsx("p", { className: "text-xs font-semibold text-slate-400 uppercase mb-2", children: "Example: Python" }), _jsx("div", { className: "rounded-lg bg-slate-900 p-3", children: _jsx("code", { className: "text-xs text-slate-300 whitespace-pre", children: `import requests
requests.post('${window.location.origin}/api/heartbeat/${monitor.heartbeats.tokenHash}')` }) })] }), monitor.heartbeats.lastHeartbeat && (_jsx("div", { className: "pt-3 border-t border-white/10", children: _jsxs("p", { className: "text-xs text-slate-400", children: ["Last heartbeat received: ", _jsx("span", { className: "text-white", children: new Date(monitor.heartbeats.lastHeartbeat).toLocaleString() })] }) }))] })] })] }) }) })), history && history.checks.length > 0 && (_jsxs(Card, { children: [_jsx("h3", { className: "text-xl font-semibold text-slate-900 dark:text-slate-900 dark:text-white mb-4", children: t("recentUptime24h") }), _jsx(UptimeBar, { checks: history.checks, hours: 24 })] })), monitor.kind === "synthetic" && history && history.checks.length > 0 && (_jsxs(Card, { children: [_jsx("h3", { className: "text-xl font-semibold text-slate-900 dark:text-white mb-4", children: t("latestJourneySteps") }), (() => {
                        const latestCheck = history.checks[history.checks.length - 1]; // Get the most recent check (last in chronological array)
                        const journeySteps = latestCheck?.payload?.journeySteps || [];
                        if (journeySteps.length === 0) {
                            return (_jsxs("div", { className: "text-slate-400 py-4", children: [_jsx("p", { children: t("noJourneyStepsYet") }), _jsx("pre", { className: "text-xs mt-2 bg-slate-800 p-2 rounded", children: JSON.stringify(latestCheck, null, 2) })] }));
                        }
                        const allPassed = journeySteps.every((step) => step.status === "up");
                        const failedStepIndex = journeySteps.findIndex((step) => step.status === "down");
                        return (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: `flex items-center gap-3 p-4 rounded-lg border ${allPassed
                                        ? 'bg-green-500/10 border-green-500/30'
                                        : 'bg-red-500/10 border-red-500/30'}`, children: [_jsx("div", { className: "text-2xl", children: allPassed ? '✅' : '❌' }), _jsxs("div", { className: "flex-1", children: [_jsx("p", { className: `font-semibold ${allPassed ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`, children: allPassed
                                                        ? t("allStepsPassed").replace("{count}", String(journeySteps.length))
                                                        : t("failedAtStep").replace("{step}", String(failedStepIndex + 1)).replace("{total}", String(journeySteps.length)) }), _jsxs("p", { className: "text-xs text-slate-600 dark:text-slate-400 mt-1", children: [t("lastChecked"), ": ", format(new Date(latestCheck.checkedAt), "MMM dd, yyyy HH:mm:ss")] })] })] }), _jsx("div", { className: "space-y-2", children: journeySteps.map((step, index) => {
                                        const isPassed = step.status === "up";
                                        const isFailed = step.status === "down";
                                        return (_jsxs("div", { className: `flex items-start gap-3 p-3 rounded-lg border ${isPassed
                                                ? 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700'
                                                : 'bg-red-500/5 border-red-500/30'}`, children: [_jsx("div", { className: `flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${isPassed
                                                        ? 'bg-green-500 text-white'
                                                        : 'bg-red-500 text-white'}`, children: index + 1 }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-center gap-2 mb-1", children: [_jsx("span", { className: `text-sm font-medium ${isPassed
                                                                        ? 'text-slate-900 dark:text-white'
                                                                        : 'text-red-600 dark:text-red-400'}`, children: step.label }), _jsx("span", { className: `text-xs px-2 py-0.5 rounded ${isPassed
                                                                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                                                        : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'}`, children: isPassed ? t("passed") : t("failed") })] }), isFailed && step.detail && (_jsxs("div", { className: "mt-2 p-3 bg-red-900/20 dark:bg-red-900/40 rounded border border-red-500/30", children: [_jsxs("p", { className: "text-xs font-semibold text-red-600 dark:text-red-400 mb-1", children: [t("errorDetails"), ":"] }), _jsx("pre", { className: "text-xs text-red-700 dark:text-red-300 whitespace-pre-wrap break-words font-mono", children: step.detail })] }))] }), _jsx("div", { className: "flex-shrink-0", children: isPassed ? (_jsx("svg", { className: "w-5 h-5 text-green-500", fill: "currentColor", viewBox: "0 0 20 20", children: _jsx("path", { fillRule: "evenodd", d: "M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z", clipRule: "evenodd" }) })) : (_jsx("svg", { className: "w-5 h-5 text-red-500", fill: "currentColor", viewBox: "0 0 20 20", children: _jsx("path", { fillRule: "evenodd", d: "M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z", clipRule: "evenodd" }) })) })] }, index));
                                    }) })] }));
                    })()] })), isEditing && (_jsxs(Card, { children: [_jsx("h3", { className: "text-xl font-semibold text-slate-900 dark:text-slate-900 dark:text-white mb-4", children: t("editMonitor") }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "text-sm text-slate-600 dark:text-slate-400 block mb-2", children: t("name") }), _jsx("input", { className: "w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-white", value: editForm.name, onChange: (e) => setEditForm((prev) => ({ ...prev, name: e.target.value })) })] }), monitor.kind === "http" && (_jsxs("div", { children: [_jsx("label", { className: "text-sm text-slate-600 dark:text-slate-400 block mb-2", children: t("url") }), _jsx("input", { className: "w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-white", value: editForm.url, onChange: (e) => setEditForm((prev) => ({ ...prev, url: e.target.value })) })] })), monitor.kind === "tcp" && (_jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: "text-sm text-slate-600 dark:text-slate-400 block mb-2", children: "Host" }), _jsx("input", { className: "w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-white", value: editForm.host, onChange: (e) => setEditForm((prev) => ({ ...prev, host: e.target.value })) })] }), _jsxs("div", { children: [_jsx("label", { className: "text-sm text-slate-600 dark:text-slate-400 block mb-2", children: "Port" }), _jsx("input", { type: "number", className: "w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-white", value: editForm.port, onChange: (e) => setEditForm((prev) => ({ ...prev, port: e.target.value })) })] })] })), monitor.kind === "ping" && (_jsxs("div", { children: [_jsx("label", { className: "text-sm text-slate-600 dark:text-slate-400 block mb-2", children: t("host") }), _jsx("input", { className: "w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-white", value: editForm.host, onChange: (e) => setEditForm((prev) => ({ ...prev, host: e.target.value })) })] })), monitor.kind === "dns" && (_jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: "text-sm text-slate-600 dark:text-slate-400 block mb-2", children: t("record") }), _jsx("input", { className: "w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-white", value: editForm.record, onChange: (e) => setEditForm((prev) => ({ ...prev, record: e.target.value })) })] }), _jsxs("div", { children: [_jsx("label", { className: "text-sm text-slate-600 dark:text-slate-400 block mb-2", children: t("dnsType") }), _jsxs("select", { className: "w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-slate-900 dark:text-white h-[46px]", value: editForm.recordType, onChange: (e) => setEditForm((prev) => ({ ...prev, recordType: e.target.value })), children: [_jsx("option", { value: "A", children: t("aRecord") }), _jsx("option", { value: "AAAA", children: t("aaaaRecord") }), _jsx("option", { value: "CNAME", children: t("cnameRecord") }), _jsx("option", { value: "MX", children: t("mxRecord") }), _jsx("option", { value: "TXT", children: t("txtRecord") })] })] })] })), monitor.kind === "certificate" && (_jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: "text-sm text-slate-600 dark:text-slate-400 block mb-2", children: "Host" }), _jsx("input", { className: "w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-white", value: editForm.host, onChange: (e) => setEditForm((prev) => ({ ...prev, host: e.target.value })) })] }), _jsxs("div", { children: [_jsx("label", { className: "text-sm text-slate-600 dark:text-slate-400 block mb-2", children: "Port" }), _jsx("input", { type: "number", className: "w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-white", value: editForm.port, onChange: (e) => setEditForm((prev) => ({ ...prev, port: e.target.value })), placeholder: "443" })] })] })), monitor.kind === "docker" && (_jsxs("div", { children: [_jsx("label", { className: "text-sm text-slate-600 dark:text-slate-400 block mb-2", children: t("containerName") }), _jsx("input", { className: "w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-white", value: editForm.containerName, onChange: (e) => setEditForm((prev) => ({ ...prev, containerName: e.target.value })) })] })), _jsxs("div", { children: [_jsx("label", { className: "text-sm text-slate-600 dark:text-slate-400 block mb-2", children: t("intervalSeconds") }), _jsx("input", { type: "number", className: "w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-white", value: editForm.interval / 1000, onChange: (e) => setEditForm((prev) => ({ ...prev, interval: Number(e.target.value) * 1000 })) })] }), _jsxs("div", { className: "flex gap-2", children: [_jsx(Button, { onClick: handleSave, disabled: updateMutation.isPending, children: updateMutation.isPending ? t("saving") : t("saveChanges") }), _jsx(Button, { variant: "ghost", onClick: () => setIsEditing(false), children: t("cancel") })] })] })] })), history && (_jsxs("div", { className: "grid gap-6 md:grid-cols-4", children: [_jsxs(Card, { children: [_jsx("p", { className: "text-sm text-slate-600 dark:text-slate-400", children: t("uptime") }), _jsxs("p", { className: "text-3xl font-bold text-slate-900 dark:text-slate-900 dark:text-white mt-2", children: [history.stats.uptimePercentage.toFixed(2), "%"] })] }), _jsxs(Card, { children: [_jsx("p", { className: "text-sm text-slate-600 dark:text-slate-400", children: t("avgResponseTime") }), _jsx("p", { className: "text-3xl font-bold text-slate-900 dark:text-slate-900 dark:text-white mt-2", children: history.stats.avgResponseTime !== null ? `${history.stats.avgResponseTime}ms` : "N/A" })] }), _jsxs(Card, { children: [_jsx("p", { className: "text-sm text-slate-600 dark:text-slate-400", children: t("totalChecks") }), _jsx("p", { className: "text-3xl font-bold text-slate-900 dark:text-slate-900 dark:text-white mt-2", children: history.stats.totalChecks })] }), _jsxs(Card, { children: [_jsx("p", { className: "text-sm text-slate-600 dark:text-slate-400", children: t("failedChecks") }), _jsx("p", { className: "text-3xl font-bold text-slate-900 dark:text-slate-900 dark:text-white mt-2", children: history.stats.downChecks })] })] })), _jsxs(Card, { children: [_jsx("h3", { className: "text-xl font-semibold text-slate-900 dark:text-slate-900 dark:text-white mb-4", children: t("responseTimeHistory") }), latencyData.length > 0 ? (_jsx("div", { className: "w-full overflow-x-auto", children: _jsx(LineChart, { data: {
                                labels: latencyData.map(d => d.time),
                                datasets: [
                                    {
                                        label: t("responseTimeMs"),
                                        data: latencyData.map(d => d.latency),
                                        borderColor: '#3b82f6',
                                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                                        borderWidth: 2,
                                        pointRadius: 0,
                                        fill: true,
                                        tension: 0.4,
                                    },
                                ],
                            }, options: {
                                responsive: true,
                                maintainAspectRatio: false,
                                scales: {
                                    y: {
                                        beginAtZero: true,
                                        ticks: { color: '#94a3b8' },
                                        grid: { color: '#334155' },
                                    },
                                    x: {
                                        ticks: { color: '#94a3b8' },
                                        grid: { color: '#334155' },
                                    },
                                },
                                plugins: {
                                    legend: { display: false },
                                    tooltip: {
                                        backgroundColor: '#1e293b',
                                        borderColor: '#334155',
                                        borderWidth: 1,
                                    },
                                },
                            }, height: 300 }) })) : (_jsxs("div", { className: "text-slate-400", children: [_jsx("p", { children: t("noLatencyDataAvailable") }), history && (_jsxs("p", { className: "text-xs mt-2", children: ["Total checks: ", history.checks?.length || 0, " | Checks with latency: ", history.checks?.filter(c => c.latencyMs != null && c.latencyMs > 0).length || 0] }))] }))] }), _jsxs(Card, { children: [_jsx("h3", { className: "text-xl font-semibold text-slate-900 dark:text-slate-900 dark:text-white mb-4", children: t("thirtyDayUptime") }), uptimeData && uptimeData.length > 0 ? (_jsx("div", { className: "w-full", style: { height: '300px' }, children: _jsx(LineChart, { data: {
                                labels: uptimeData.map(d => d.date),
                                datasets: [
                                    {
                                        label: t("uptimePercent"),
                                        data: uptimeData.map(d => d.uptime),
                                        borderColor: '#10b981',
                                        backgroundColor: 'rgba(16, 185, 129, 0.2)',
                                        borderWidth: 2,
                                        pointRadius: 2,
                                        pointHoverRadius: 4,
                                        fill: true,
                                        tension: 0.4,
                                    },
                                ],
                            }, options: {
                                responsive: true,
                                maintainAspectRatio: false,
                                scales: {
                                    y: {
                                        beginAtZero: true,
                                        max: 100,
                                        ticks: {
                                            color: '#94a3b8',
                                            callback: (value) => `${value}%`,
                                        },
                                        grid: { color: '#334155' },
                                    },
                                    x: {
                                        ticks: { color: '#94a3b8' },
                                        grid: { color: '#334155' },
                                    },
                                },
                                plugins: {
                                    legend: { display: false },
                                    tooltip: {
                                        backgroundColor: '#1e293b',
                                        borderColor: '#334155',
                                        borderWidth: 1,
                                        callbacks: {
                                            label: (context) => `Uptime: ${context.parsed.y?.toFixed(2) ?? 0}%`,
                                        },
                                    },
                                },
                            } }) })) : (_jsxs("div", { className: "text-slate-400", children: [_jsx("p", { children: t("noUptimeDataAvailable") }), uptime && (_jsxs("div", { className: "text-xs mt-2 space-y-1", children: [_jsxs("p", { children: ["Days with data: ", uptime.days?.length || 0] }), _jsxs("p", { children: ["Days filtered: ", uptimeData.length] }), uptime.days && uptime.days.length > 0 && (_jsx("pre", { className: "text-xs bg-slate-800 p-2 rounded mt-2 overflow-auto", children: JSON.stringify(uptime.days.slice(0, 3), null, 2) }))] }))] }))] }), history && history.stats.totalChecks > 0 && (_jsxs(Card, { children: [_jsx("h3", { className: "text-xl font-semibold text-slate-900 dark:text-slate-900 dark:text-white mb-4", children: t("uptimeDistribution") }), _jsxs("div", { className: "flex flex-col md:flex-row items-center justify-center gap-8", children: [_jsx("div", { className: "w-64 h-64", children: _jsx(DoughnutChart, { data: {
                                        labels: [t("up"), t("down")],
                                        datasets: [
                                            {
                                                data: [history.stats.upChecks, history.stats.downChecks],
                                                backgroundColor: ['#10b981', '#ef4444'],
                                                borderColor: '#1e293b',
                                                borderWidth: 2,
                                            },
                                        ],
                                    }, options: {
                                        responsive: true,
                                        maintainAspectRatio: true,
                                        plugins: {
                                            legend: {
                                                display: true,
                                                position: 'bottom',
                                                labels: {
                                                    color: '#94a3b8',
                                                    padding: 15,
                                                    font: { size: 12 },
                                                },
                                            },
                                            tooltip: {
                                                backgroundColor: '#1e293b',
                                                borderColor: '#334155',
                                                borderWidth: 1,
                                                callbacks: {
                                                    label: (context) => {
                                                        const label = context.label || '';
                                                        const value = context.parsed || 0;
                                                        const total = history.stats.totalChecks;
                                                        const percentage = ((value / total) * 100).toFixed(1);
                                                        return `${label}: ${value} (${percentage}%)`;
                                                    },
                                                },
                                            },
                                        },
                                    } }) }), _jsxs("div", { className: "flex flex-col gap-4", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "w-4 h-4 rounded-full bg-green-500" }), _jsxs("span", { className: "text-sm text-slate-300", children: ["Up: ", history.stats.upChecks, " (", ((history.stats.upChecks / history.stats.totalChecks) * 100).toFixed(1), "%)"] })] }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "w-4 h-4 rounded-full bg-red-500" }), _jsxs("span", { className: "text-sm text-slate-300", children: ["Down: ", history.stats.downChecks, " (", ((history.stats.downChecks / history.stats.totalChecks) * 100).toFixed(1), "%)"] })] }), _jsxs("div", { className: "text-sm text-slate-600 dark:text-slate-400 mt-2", children: ["Total Checks: ", history.stats.totalChecks] })] })] })] })), history && (_jsxs(Card, { children: [_jsx("h3", { className: "text-xl font-semibold text-slate-900 dark:text-slate-900 dark:text-white mb-4", children: t("recentChecks") }), _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-left text-sm text-slate-300", children: [_jsx("thead", { children: _jsxs("tr", { className: "text-xs uppercase tracking-widest text-slate-500", children: [_jsx("th", { className: "pb-3", children: t("time") }), _jsx("th", { className: "pb-3", children: t("status") }), _jsx("th", { className: "pb-3", children: t("latency") }), monitor.kind === "synthetic" && _jsx("th", { className: "pb-3", children: t("steps") })] }) }), _jsx("tbody", { className: "divide-y divide-white/5", children: history.checks.slice(0, 20).map((check) => {
                                        const journeySteps = monitor.kind === "synthetic" ? (check?.payload?.journeySteps || []) : [];
                                        const passedSteps = journeySteps.filter((s) => s.status === "up").length;
                                        const totalSteps = journeySteps.length;
                                        return (_jsxs("tr", { children: [_jsx("td", { className: "py-3", children: format(new Date(check.checkedAt), "MMM dd, HH:mm:ss") }), _jsx("td", { className: "py-3", children: _jsx(StatusBadge, { status: check.status }) }), _jsx("td", { className: "py-3", children: check.latencyMs !== null ? `${check.latencyMs}ms` : "N/A" }), monitor.kind === "synthetic" && (_jsx("td", { className: "py-3", children: totalSteps > 0 ? (_jsxs("span", { className: `text-xs px-2 py-1 rounded ${passedSteps === totalSteps
                                                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                                            : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'}`, children: [passedSteps, "/", totalSteps, " passed"] })) : (_jsx("span", { className: "text-xs text-slate-500", children: "-" })) }))] }, check.id));
                                    }) })] }) })] }))] }));
};

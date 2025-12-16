import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Sparkles, AlertTriangle, Clock } from "lucide-react";
import { Line as LineChart } from "react-chartjs-2";
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Filler } from "chart.js";
import { api } from "../lib/api.js";
import { useAuth } from "../providers/auth-context.js";
import { useRealtime } from "../hooks/use-realtime.js";
import { Card } from "../components/ui/card.js";
import { StatusBadge } from "../components/status-badge.js";
import { useTranslation } from "../hooks/use-translation.js";
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler);
const getSummaryLabel = (t, status) => {
    const labels = {
        up: t("allSystemsThriving"),
        down: t("incidentActive"),
        pending: t("awaitingData"),
    };
    return labels[status];
};
const MiniGraph = ({ monitorId, status }) => {
    const { token } = useAuth();
    const { data } = useQuery({
        queryKey: ["monitor-mini-graph", monitorId],
        queryFn: () => api.getMonitorHistory(token, monitorId, 24),
        enabled: Boolean(token),
    });
    if (!data?.checks || data.checks.length === 0) {
        return _jsx("div", { className: "h-8 w-16 rounded bg-slate-200 dark:bg-white/5" });
    }
    // Take last 24 checks for mini sparkline
    const recentChecks = data.checks.slice(-24);
    const chartData = recentChecks.map((check) => (check.status === "up" ? 100 : 0));
    const statusColor = status === "up" ? "#22c55e" : status === "down" ? "#ef4444" : "#fbbf24";
    return (_jsx("div", { className: "h-8 w-16", children: _jsx(LineChart, { data: {
                labels: chartData.map(() => ''),
                datasets: [
                    {
                        data: chartData,
                        borderColor: statusColor,
                        backgroundColor: `${statusColor}20`,
                        borderWidth: 1.5,
                        fill: true,
                        tension: 0.4,
                        pointRadius: 0,
                    },
                ],
            }, options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: { enabled: false },
                },
                scales: {
                    x: { display: false },
                    y: { display: false, min: 0, max: 100 },
                },
            } }) }));
};
const CertificateExpiryWidget = () => {
    const { token } = useAuth();
    const { data: monitors } = useQuery({
        queryKey: ["monitors"],
        queryFn: () => api.listMonitors(token),
        enabled: Boolean(token),
    });
    const certificateMonitors = useMemo(() => {
        if (!monitors)
            return [];
        return monitors
            .filter((m) => m.kind === "certificate")
            .map((m) => {
            const expiresAt = m.meta?.certificateExpiresAt;
            if (!expiresAt)
                return null;
            const expiryDate = new Date(expiresAt);
            const now = new Date();
            const daysRemaining = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            let color = "text-green-400";
            if (daysRemaining < 7)
                color = "text-red-400";
            else if (daysRemaining < 30)
                color = "text-yellow-400";
            return { ...m, daysRemaining, color, expiryDate };
        })
            .filter((m) => m !== null)
            .sort((a, b) => a.daysRemaining - b.daysRemaining);
    }, [monitors]);
    if (certificateMonitors.length === 0)
        return null;
    return (_jsxs(Card, { children: [_jsxs("div", { className: "mb-4 flex items-center gap-3", children: [_jsx(AlertTriangle, { className: "h-5 w-5 text-yellow-400" }), _jsx("h3", { className: "text-lg font-semibold text-slate-900 dark:text-white", children: "SSL Certificate Expiry" })] }), _jsx("div", { className: "space-y-3", children: certificateMonitors.slice(0, 5).map((cert) => (_jsxs(Link, { to: `/monitors/${cert.id}`, className: "flex items-center justify-between rounded-lg border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 p-3 transition hover:bg-slate-200 dark:hover:bg-white/10", children: [_jsxs("div", { children: [_jsx("p", { className: "font-medium text-slate-900 dark:text-white", children: cert.name }), _jsxs("p", { className: "text-xs text-slate-500 dark:text-slate-400", children: ["Expires ", cert.expiryDate.toLocaleDateString()] })] }), _jsxs("div", { className: `text-right ${cert.color}`, children: [_jsx("p", { className: "text-2xl font-bold", children: cert.daysRemaining }), _jsx("p", { className: "text-xs", children: "days" })] })] }, cert.id))) })] }));
};
export const DashboardRoute = () => {
    const { token } = useAuth();
    const { t } = useTranslation();
    const { data, isLoading } = useQuery({ queryKey: ["status"], queryFn: () => api.listStatus(token), enabled: Boolean(token) });
    const [snapshots, setSnapshots] = useState([]);
    useEffect(() => {
        if (data) {
            console.log('Dashboard data received:', data);
            console.log('Certificate monitors:', data.filter((m) => m.kind === 'certificate'));
            setSnapshots(data);
        }
    }, [data]);
    useRealtime((event) => {
        if (event.type !== "monitor:result")
            return;
        setSnapshots((prev) => {
            const existing = prev.find((item) => item.id === event.payload.monitorId);
            if (!existing)
                return prev;
            return prev.map((item) => item.id === event.payload.monitorId
                ? {
                    ...item,
                    status: event.payload.status,
                    lastCheck: event.payload.checkedAt
                }
                : item);
        });
    }, token);
    const counts = useMemo(() => {
        return snapshots.reduce((acc, monitor) => {
            acc[monitor.status] += 1;
            return acc;
        }, { up: 0, down: 0, pending: 0 });
    }, [snapshots]);
    if (isLoading && snapshots.length === 0) {
        return _jsx("p", { className: "text-slate-600 dark:text-slate-400", children: "Loading telemetry..." });
    }
    return (_jsxs("div", { className: "space-y-6", children: [_jsx("div", { className: "grid gap-4 md:grid-cols-3", children: Object.keys(counts).map((status) => (_jsxs(Card, { className: "space-y-3", children: [_jsx("p", { className: "text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400", children: getSummaryLabel(t, status) }), _jsxs("div", { className: "flex items-end justify-between", children: [_jsxs("div", { children: [_jsx("div", { className: "text-4xl font-semibold text-slate-900 dark:text-white", children: counts[status] }), _jsxs("p", { className: "text-sm text-slate-600 dark:text-slate-400", children: ["monitors ", status] })] }), _jsx(StatusBadge, { status: status })] })] }, status))) }), _jsx(CertificateExpiryWidget, {}), _jsxs(Card, { children: [_jsxs("div", { className: "mb-6 flex items-center gap-3", children: [_jsx(Sparkles, { className: "h-5 w-5 text-primary" }), _jsx("h3", { className: "text-lg font-semibold text-slate-900 dark:text-white", children: t("monitorsTitle") })] }), _jsx("div", { className: "grid gap-4 md:grid-cols-2", children: snapshots.map((monitor) => (_jsxs(Link, { to: `/monitors/${monitor.id}`, className: "rounded-2xl border border-slate-200 dark:border-white/5 bg-slate-100 dark:bg-white/5 p-4 transition hover:bg-slate-200 dark:hover:bg-white/10", children: [_jsxs("div", { className: "flex items-start justify-between", children: [_jsxs("div", { className: "flex-1", children: [_jsx("p", { className: "text-sm text-slate-500 dark:text-slate-400", children: monitor.id }), _jsx("p", { className: "text-xl font-semibold text-slate-900 dark:text-white", children: monitor.name })] }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsx(MiniGraph, { monitorId: monitor.id, status: monitor.status }), _jsxs("div", { className: "flex flex-col items-end gap-2", children: [_jsx(StatusBadge, { status: monitor.status }), monitor.inMaintenance && (_jsx("span", { className: "rounded-full bg-yellow-500 px-2 py-0.5 text-xs font-semibold text-black", children: "Maintenance" }))] })] })] }), _jsxs("div", { className: "mt-3 space-y-1", children: [_jsxs("div", { className: "flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400", children: [_jsx(Clock, { className: "h-3 w-3" }), monitor.lastCheck ? new Date(monitor.lastCheck).toLocaleTimeString() : "Pending"] }), monitor.kind === "certificate" && (_jsx("div", { className: "text-xs", children: monitor.meta?.certificateDaysLeft ? (_jsxs("div", { className: `flex items-center gap-2 font-medium ${monitor.meta.certificateDaysLeft < 7
                                                    ? 'text-red-600 dark:text-red-400'
                                                    : monitor.meta.certificateDaysLeft < 30
                                                        ? 'text-yellow-600 dark:text-yellow-400'
                                                        : 'text-green-600 dark:text-green-400'}`, children: ["\uD83D\uDD12 Expires in ", monitor.meta.certificateDaysLeft, " days", monitor.meta.certificateExpiresAt && (_jsxs("span", { className: "text-slate-500 dark:text-slate-400", children: ["(", new Date(monitor.meta.certificateExpiresAt).toLocaleDateString(), ")"] }))] })) : (_jsx("span", { className: "text-slate-400", children: "Certificate monitor - awaiting check" })) }))] })] }, monitor.id))) })] })] }));
};

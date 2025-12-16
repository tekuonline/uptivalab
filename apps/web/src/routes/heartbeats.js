import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api.js";
import { useAuth } from "../providers/auth-context.js";
import { Card } from "../components/ui/card.js";
import { Button } from "../components/ui/button.js";
import { Trash2, Copy } from "lucide-react";
import { format } from "date-fns";
import { useTranslation } from "../hooks/use-translation.js";
export const HeartbeatsRoute = () => {
    const { t } = useTranslation();
    const { token } = useAuth();
    const queryClient = useQueryClient();
    const [form, setForm] = useState({ monitorId: "", heartbeatEvery: 300 });
    const [error, setError] = useState(null);
    const { data: heartbeats } = useQuery({
        queryKey: ["heartbeats"],
        queryFn: () => api.listHeartbeats(token),
        enabled: Boolean(token),
    });
    const { data: monitors } = useQuery({
        queryKey: ["monitors"],
        queryFn: () => api.listMonitors(token),
        enabled: Boolean(token),
    });
    // Filter to only show push monitors
    const pushMonitors = monitors?.filter((monitor) => monitor.kind === "push") || [];
    // Filter out monitors that already have heartbeat tokens
    const availableMonitors = pushMonitors.filter((monitor) => !heartbeats?.some((hb) => hb.monitorId === monitor.id));
    const createMutation = useMutation({
        mutationFn: (payload) => api.createHeartbeat(token, payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["heartbeats"] });
            setForm({ monitorId: "", heartbeatEvery: 300 });
            setError(null);
        },
        onError: (err) => {
            if (err?.response?.status === 409) {
                setError(t("deleteExistingToken"));
            }
            else {
                setError(err?.message || t("error"));
            }
        },
    });
    const deleteMutation = useMutation({
        mutationFn: (id) => api.deleteHeartbeat(token, id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["heartbeats"] });
        },
    });
    const copyToClipboard = (url) => {
        const fullUrl = `${window.location.origin}${url}`;
        navigator.clipboard.writeText(fullUrl);
        alert(t("heartbeatUrlCopied"));
    };
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs(Card, { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-xl font-semibold text-slate-900 dark:text-white", children: t("createHeartbeatToken") }), _jsx("p", { className: "text-sm text-slate-600 dark:text-slate-400", children: t("generateHeartbeatUrl") })] }), error && (_jsx("div", { className: "rounded-lg bg-red-500/10 border border-red-500/30 dark:border-red-500/20 p-3", children: _jsx("p", { className: "text-sm text-red-700 dark:text-red-200", children: error }) })), pushMonitors.length === 0 ? (_jsxs("div", { className: "rounded-lg bg-yellow-500/10 border border-yellow-500/30 dark:border-yellow-500/20 p-4 text-center", children: [_jsxs("p", { className: "text-sm text-yellow-700 dark:text-yellow-200 mb-2", children: ["\uD83D\uDCDD ", t("noPushMonitors")] }), _jsx("p", { className: "text-xs text-yellow-600 dark:text-yellow-300/70", children: t("noPushMonitorsDesc") }), _jsx("a", { href: "/monitors", className: "text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline mt-2 inline-block", children: t("goToMonitors") })] })) : availableMonitors.length === 0 ? (_jsxs("div", { className: "rounded-lg bg-blue-500/10 border border-blue-500/30 dark:border-blue-500/20 p-4 text-center", children: [_jsxs("p", { className: "text-sm text-blue-700 dark:text-blue-200 mb-2", children: ["\u2705 ", t("allPushHaveTokens")] }), _jsx("p", { className: "text-xs text-blue-600 dark:text-blue-300/70", children: t("deleteExistingToken") })] })) : (_jsxs("form", { className: "grid gap-3 md:grid-cols-3", onSubmit: (e) => {
                            e.preventDefault();
                            setError(null);
                            createMutation.mutate(form);
                        }, children: [_jsxs("select", { className: "rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-slate-900 dark:text-white h-[46px]", value: form.monitorId, onChange: (e) => setForm((prev) => ({ ...prev, monitorId: e.target.value })), required: true, children: [_jsx("option", { value: "", children: t("selectMonitors") }), availableMonitors.map((monitor) => (_jsx("option", { value: monitor.id, children: monitor.name }, monitor.id)))] }), _jsx("input", { type: "number", className: "rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-white", placeholder: t("interval"), value: form.heartbeatEvery, onChange: (e) => setForm((prev) => ({ ...prev, heartbeatEvery: Number(e.target.value) })), min: "60", max: "86400", required: true }), _jsx(Button, { type: "submit", disabled: createMutation.isPending, children: createMutation.isPending ? t("loading") : t("createHeartbeatToken") })] }))] }), _jsxs(Card, { children: [_jsx("h3", { className: "mb-4 text-xl font-semibold text-slate-900 dark:text-white", children: t("activeHeartbeats") }), _jsxs("div", { className: "space-y-4", children: [heartbeats?.map((heartbeat) => (_jsx("div", { className: "rounded-lg border border-white/10 bg-white/5 p-4", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex-1", children: [_jsx("h4", { className: "font-semibold text-slate-900 dark:text-white", children: heartbeat.monitor.name }), _jsxs("p", { className: "text-sm text-slate-600 dark:text-slate-400", children: [t("heartbeatEvery"), " ", heartbeat.heartbeatEvery, "s"] }), heartbeat.lastHeartbeat && (_jsxs("p", { className: "text-xs text-slate-500 mt-1", children: [t("lastCheck"), ": ", format(new Date(heartbeat.lastHeartbeat), "MMM dd, HH:mm:ss")] })), _jsxs("div", { className: "mt-2 flex items-center gap-2", children: [_jsxs("code", { className: "text-xs bg-black/20 px-2 py-1 rounded", children: ["POST /api/heartbeat/", heartbeat.tokenHash] }), _jsx("button", { onClick: () => copyToClipboard(`/api/heartbeat/${heartbeat.tokenHash}`), className: "text-slate-400 hover:text-white", children: _jsx(Copy, { className: "h-4 w-4" }) })] })] }), _jsx(Button, { variant: "ghost", onClick: () => {
                                                if (confirm(t("deleteHeartbeatConfirm"))) {
                                                    deleteMutation.mutate(heartbeat.id);
                                                }
                                            }, disabled: deleteMutation.isPending, children: _jsx(Trash2, { className: "h-4 w-4" }) })] }) }, heartbeat.id))), !heartbeats?.length && (_jsx("p", { className: "text-center text-slate-400 py-8", children: t("noHeartbeats") }))] })] })] }));
};

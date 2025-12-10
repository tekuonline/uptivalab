import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api.js";
import { useAuth } from "../providers/auth-context.js";
import { Card } from "../components/ui/card.js";
export const NotificationsRoute = () => {
    const { token } = useAuth();
    const { data, isLoading } = useQuery({ queryKey: ["notifications"], queryFn: () => api.listNotifications(token), enabled: Boolean(token) });
    if (isLoading)
        return _jsx("p", { className: "text-slate-400", children: "Loading notification channels\u2026" });
    return (_jsxs(Card, { children: [_jsx("h3", { className: "mb-4 text-xl font-semibold text-white", children: "Notification channels" }), _jsxs("div", { className: "space-y-3", children: [data?.map((channel) => (_jsxs("div", { className: "rounded-2xl border border-white/10 bg-white/5 p-4", children: [_jsx("p", { className: "text-sm uppercase tracking-[0.2em] text-slate-500", children: channel.type }), _jsx("p", { className: "text-lg font-medium text-white", children: channel.name })] }, channel.id))), (data?.length ?? 0) === 0 && _jsx("p", { className: "text-sm text-slate-400", children: "No channels yet." })] })] }));
};

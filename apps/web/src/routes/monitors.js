import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api.js";
import { useAuth } from "../providers/auth-context.js";
import { Card } from "../components/ui/card.js";
import { Button } from "../components/ui/button.js";
import { StatusBadge } from "../components/status-badge.js";
export const MonitorsRoute = () => {
    const { token } = useAuth();
    const queryClient = useQueryClient();
    const { data } = useQuery({ queryKey: ["monitors"], queryFn: () => api.listMonitors(token), enabled: Boolean(token) });
    const [form, setForm] = useState({ name: "", url: "" });
    const mutation = useMutation({
        mutationFn: (payload) => api.createMonitor(token, {
            name: payload.name,
            interval: 60000,
            kind: "http",
            config: { url: payload.url },
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["monitors"] });
            setForm({ name: "", url: "" });
        },
    });
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs(Card, { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-xl font-semibold text-white", children: "Create monitor" }), _jsx("p", { className: "text-sm text-slate-400", children: "Kick off a new HTTP monitor by pasting a URL." })] }), _jsxs("form", { className: "grid gap-3 md:grid-cols-3", onSubmit: (event) => {
                            event.preventDefault();
                            mutation.mutate(form);
                        }, children: [_jsx("input", { className: "rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white", placeholder: "Display name", value: form.name, onChange: (e) => setForm((prev) => ({ ...prev, name: e.target.value })), required: true }), _jsx("input", { className: "rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white", placeholder: "https://", value: form.url, onChange: (e) => setForm((prev) => ({ ...prev, url: e.target.value })), required: true }), _jsx(Button, { type: "submit", disabled: mutation.isPending, children: mutation.isPending ? "Creating" : "Add monitor" })] })] }), _jsxs(Card, { children: [_jsx("h3", { className: "mb-4 text-xl font-semibold text-white", children: "Existing monitors" }), _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-left text-sm text-slate-300", children: [_jsx("thead", { children: _jsxs("tr", { className: "text-xs uppercase tracking-widest text-slate-500", children: [_jsx("th", { className: "pb-3", children: "Name" }), _jsx("th", { className: "pb-3", children: "Kind" }), _jsx("th", { className: "pb-3", children: "Interval" }), _jsx("th", { className: "pb-3", children: "Status" })] }) }), _jsx("tbody", { className: "divide-y divide-white/5", children: data?.map((monitor) => (_jsxs("tr", { children: [_jsx("td", { className: "py-3 font-semibold text-white", children: monitor.name }), _jsx("td", { className: "py-3 capitalize text-slate-400", children: monitor.kind }), _jsxs("td", { className: "py-3", children: [Math.round(monitor.interval / 1000), "s"] }), _jsx("td", { className: "py-3", children: _jsx(StatusBadge, { status: monitor.status ?? "pending" }) })] }, monitor.id))) })] }) })] })] }));
};

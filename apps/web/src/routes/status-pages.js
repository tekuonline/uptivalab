import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api.js";
import { useAuth } from "../providers/auth-context.js";
import { Card } from "../components/ui/card.js";
import { Button } from "../components/ui/button.js";
export const StatusPagesRoute = () => {
    const { token } = useAuth();
    const { data, isLoading } = useQuery({ queryKey: ["status-pages"], queryFn: () => api.listStatusPages(token), enabled: Boolean(token) });
    if (isLoading) {
        return _jsx("p", { className: "text-slate-400", children: "Loading status pages\u2026" });
    }
    return (_jsxs("div", { className: "space-y-6", children: [_jsx(Card, { children: _jsxs("div", { className: "flex flex-wrap items-start justify-between gap-4", children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs uppercase tracking-[0.35em] text-slate-400", children: "External facing" }), _jsx("h3", { className: "text-2xl font-semibold text-white", children: "Status pages" }), _jsx("p", { className: "text-sm text-slate-400", children: "Publish realtime transparency to stakeholders." })] }), _jsx(Button, { variant: "secondary", children: "New page" })] }) }), _jsxs("div", { className: "grid gap-4 md:grid-cols-2", children: [data?.map((page) => (_jsxs(Card, { className: "space-y-2", children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs uppercase tracking-[0.4em] text-slate-500", children: page.slug }), _jsx("h4", { className: "text-xl font-semibold text-white", children: page.name })] }), page.heroMessage && _jsx("p", { className: "text-sm text-slate-400", children: page.heroMessage }), _jsx(Button, { asChild: true, variant: "ghost", className: "px-0 text-primary", children: _jsx("a", { href: `/status/${page.slug}`, target: "_blank", rel: "noreferrer", children: "View public page \u2192" }) })] }, page.id))), (data?.length ?? 0) === 0 && _jsx("p", { className: "text-sm text-slate-400", children: "No status pages yet." })] })] }));
};

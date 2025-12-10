import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { NavLink } from "react-router-dom";
import { Monitor, Bell, Activity, Settings, LayoutDashboard } from "lucide-react";
const links = [
    { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
    { label: "Monitors", to: "/monitors", icon: Monitor },
    { label: "Notifications", to: "/notifications", icon: Bell },
    { label: "Incidents", to: "/incidents", icon: Activity },
    { label: "Status Pages", to: "/status-pages", icon: Settings },
];
export const Sidebar = () => (_jsxs("aside", { className: "glass-panel flex h-full w-64 flex-col rounded-3xl p-6", children: [_jsxs("div", { className: "mb-10", children: [_jsx("p", { className: "text-xs uppercase tracking-[0.35em] text-slate-400", children: "UptivaLab" }), _jsx("h1", { className: "text-2xl font-semibold text-white", children: "Command Center" })] }), _jsx("nav", { className: "space-y-2", children: links.map((link) => (_jsxs(NavLink, { to: link.to, className: ({ isActive }) => `flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition ${isActive ? "bg-white/10 text-white" : "text-slate-400 hover:text-white"}`, children: [_jsx(link.icon, { className: "h-5 w-5" }), link.label] }, link.to))) })] }));

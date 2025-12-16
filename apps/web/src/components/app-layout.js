import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Outlet } from "react-router-dom";
import { useAuth } from "../providers/auth-context.js";
import { Button } from "./ui/button.js";
import { Sidebar } from "./sidebar.js";
export const AppLayout = () => {
    const { logout } = useAuth();
    return (_jsxs("div", { className: "flex min-h-screen gap-6 bg-background/95 px-6 py-8 text-foreground", children: [_jsx(Sidebar, {}), _jsxs("main", { className: "flex-1 space-y-6", children: [_jsxs("header", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm uppercase tracking-[0.4em] text-slate-500 dark:text-slate-600 dark:text-slate-400", children: "Realtime overview" }), _jsx("h2", { className: "text-3xl font-semibold text-slate-900 dark:text-white", children: "Monitoring dashboard" })] }), _jsx(Button, { variant: "ghost", onClick: logout, children: "Log out" })] }), _jsx(Outlet, {})] })] }));
};

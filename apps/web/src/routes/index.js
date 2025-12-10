import { jsx as _jsx } from "react/jsx-runtime";
import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppLayout } from "../components/app-layout.js";
import { DashboardRoute } from "./dashboard.js";
import { MonitorsRoute } from "./monitors.js";
import { NotificationsRoute } from "./notifications.js";
import { IncidentsRoute } from "./incidents.js";
import { StatusPagesRoute } from "./status-pages.js";
import { LoginRoute, RegisterRoute } from "./login.js";
import { useAuth } from "../providers/auth-context.js";
const ProtectedApp = () => {
    const { isAuthenticated } = useAuth();
    if (!isAuthenticated) {
        return _jsx(Navigate, { to: "/login", replace: true });
    }
    return _jsx(AppLayout, {});
};
const router = createBrowserRouter([
    {
        path: "/",
        element: _jsx(ProtectedApp, {}), // handles layout + auth guard
        children: [
            { index: true, element: _jsx(Navigate, { to: "/dashboard", replace: true }) },
            { path: "dashboard", element: _jsx(DashboardRoute, {}) },
            { path: "monitors", element: _jsx(MonitorsRoute, {}) },
            { path: "notifications", element: _jsx(NotificationsRoute, {}) },
            { path: "incidents", element: _jsx(IncidentsRoute, {}) },
            { path: "status-pages", element: _jsx(StatusPagesRoute, {}) },
        ],
    },
    { path: "/login", element: _jsx(LoginRoute, {}) },
    { path: "/register", element: _jsx(RegisterRoute, {}) },
    { path: "*", element: _jsx(Navigate, { to: "/dashboard", replace: true }) },
]);
export default router;

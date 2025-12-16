import { jsx as _jsx } from "react/jsx-runtime";
import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppLayout } from "../components/app-layout.js";
import { DashboardRoute } from "./dashboard.js";
import { MonitorsRoute } from "./monitors.js";
import { MonitorDetailRoute } from "./monitor-detail.js";
import { HeartbeatsRoute } from "./heartbeats.js";
import { NotificationsRoute } from "./notifications.js";
import { IncidentsRoute } from "./incidents.js";
import { StatusPagesRoute } from "./status-pages.js";
import { MaintenanceRoute } from "./maintenance.js";
import { PublicStatusRoute } from "./public-status.js";
import { SettingsRoute } from "./settings.js";
import SyntheticRecorder from "./synthetic-recorder.js";
import { LoginRoute } from "./login.js";
import { SetupRoute } from "./setup.js";
import { InviteAcceptRoute } from "./invite.js";
import { useAuth } from "../providers/auth-context.js";
import { useSettings } from "../providers/settings-context.js";
import { useEffect } from "react";
const ProtectedApp = () => {
    const { isAuthenticated, setupNeeded, checkSetupNeeded } = useAuth();
    useEffect(() => {
        if (setupNeeded === null) {
            checkSetupNeeded();
        }
    }, [setupNeeded, checkSetupNeeded]);
    if (setupNeeded) {
        return _jsx(Navigate, { to: "/setup", replace: true });
    }
    if (!isAuthenticated) {
        return _jsx(Navigate, { to: "/login", replace: true });
    }
    return _jsx(AppLayout, {});
};
const DefaultRoute = () => {
    const { settings } = useSettings();
    const entryPage = settings.entryPage || "dashboard";
    return _jsx(Navigate, { to: `/${entryPage === "status" ? "status-pages" : entryPage}`, replace: true });
};
const router = createBrowserRouter([
    {
        path: "/",
        element: _jsx(ProtectedApp, {}), // handles layout + auth guard
        children: [
            { index: true, element: _jsx(DefaultRoute, {}) },
            { path: "dashboard", element: _jsx(DashboardRoute, {}) },
            { path: "monitors", element: _jsx(MonitorsRoute, {}) },
            { path: "monitors/:id", element: _jsx(MonitorDetailRoute, {}) },
            { path: "synthetic-recorder", element: _jsx(SyntheticRecorder, {}) },
            { path: "heartbeats", element: _jsx(HeartbeatsRoute, {}) },
            { path: "notifications", element: _jsx(NotificationsRoute, {}) },
            { path: "incidents", element: _jsx(IncidentsRoute, {}) },
            { path: "status-pages", element: _jsx(StatusPagesRoute, {}) },
            { path: "maintenance", element: _jsx(MaintenanceRoute, {}) },
            { path: "settings", element: _jsx(SettingsRoute, {}) },
        ],
    },
    { path: "/login", element: _jsx(LoginRoute, {}) },
    { path: "/setup", element: _jsx(SetupRoute, {}) },
    { path: "/register", element: _jsx(Navigate, { to: "/login", replace: true }) },
    { path: "/invite/:token", element: _jsx(InviteAcceptRoute, {}) },
    { path: "/status/:slug", element: _jsx(PublicStatusRoute, {}) }, // Public status page (no auth required)
    { path: "*", element: _jsx(DefaultRoute, {}) },
]);
export default router;

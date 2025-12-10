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
import { LoginRoute, RegisterRoute } from "./login.js";
import { useAuth } from "../providers/auth-context.js";
import { useSettings } from "../providers/settings-context.js";

const ProtectedApp = () => {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <AppLayout />;
};

const DefaultRoute = () => {
  const { settings } = useSettings();
  const entryPage = settings.entryPage || "dashboard";
  return <Navigate to={`/${entryPage === "status" ? "status-pages" : entryPage}`} replace />;
};

const router = createBrowserRouter([
  {
    path: "/",
    element: <ProtectedApp />, // handles layout + auth guard
    children: [
      { index: true, element: <DefaultRoute /> },
      { path: "dashboard", element: <DashboardRoute /> },
      { path: "monitors", element: <MonitorsRoute /> },
      { path: "monitors/:id", element: <MonitorDetailRoute /> },
      { path: "heartbeats", element: <HeartbeatsRoute /> },
      { path: "notifications", element: <NotificationsRoute /> },
      { path: "incidents", element: <IncidentsRoute /> },
      { path: "status-pages", element: <StatusPagesRoute /> },
      { path: "maintenance", element: <MaintenanceRoute /> },
      { path: "settings", element: <SettingsRoute /> },
    ],
  },
  { path: "/login", element: <LoginRoute /> },
  { path: "/register", element: <RegisterRoute /> },
  { path: "/status/:slug", element: <PublicStatusRoute /> }, // Public status page (no auth required)
  { path: "*", element: <DefaultRoute /> },
]);

export default router;

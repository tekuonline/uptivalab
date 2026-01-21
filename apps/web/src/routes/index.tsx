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
import { useTranslation } from "../hooks/use-translation.js";

const ProtectedApp = () => {
  const { isAuthenticated, setupNeeded } = useAuth();
  const { t, languageLoading } = useTranslation();

  // Wait for setup check and language loading to complete
  if (setupNeeded === null || languageLoading) {
    return <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900 dark:border-white mx-auto"></div>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{t("loading")}</p>
      </div>
    </div>;
  }

  if (setupNeeded) {
    return <Navigate to="/setup" replace />;
  }
  
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
      { path: "synthetic-recorder", element: <SyntheticRecorder /> },
      { path: "heartbeats", element: <HeartbeatsRoute /> },
      { path: "notifications", element: <NotificationsRoute /> },
      { path: "incidents", element: <IncidentsRoute /> },
      { path: "status-pages", element: <StatusPagesRoute /> },
      { path: "maintenance", element: <MaintenanceRoute /> },
      { path: "settings", element: <SettingsRoute /> },
    ],
  },
  { path: "/login", element: <LoginRoute /> },
  { path: "/setup", element: <SetupRoute /> },
  { path: "/register", element: <Navigate to="/login" replace /> },
  { path: "/invite/:token", element: <InviteAcceptRoute /> },
  { path: "/status/:slug", element: <PublicStatusRoute /> }, // Public status page (no auth required)
  { path: "*", element: <DefaultRoute /> },
]);

export default router;

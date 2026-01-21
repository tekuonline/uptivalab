import { Outlet } from "react-router-dom";
import { useState } from "react";
import { Menu } from "lucide-react";
import { useAuth } from "../providers/auth-context.js";
import { Button } from "./ui/button.js";
import { Sidebar } from "./sidebar.js";
import { useTranslation } from "../hooks/use-translation.js";

export const AppLayout = () => {
  const { logout } = useAuth();
  const { t } = useTranslation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen gap-4 lg:gap-6 bg-background/95 px-3 sm:px-4 lg:px-6 py-4 lg:py-8 text-foreground">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="flex-1 space-y-4 lg:space-y-6 min-w-0">
        <header className="flex items-center justify-between gap-2 flex-wrap">
          {/* Mobile hamburger menu */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-white/10 transition"
            aria-label="Open menu"
          >
            <Menu className="h-6 w-6 text-slate-600 dark:text-slate-400" />
          </button>
          
          <div className="flex-1 min-w-0">
            <p className="text-xs sm:text-sm uppercase tracking-[0.3em] sm:tracking-[0.4em] text-slate-500 dark:text-slate-600 dark:text-slate-400 truncate">{t("realtimeOverview")}</p>
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-slate-900 dark:text-white truncate">{t("monitoringDashboard")}</h2>
          </div>
          <Button variant="ghost" onClick={logout} className="shrink-0">
            {t("logout")}
          </Button>
        </header>
        <Outlet />
      </main>
    </div>
  );
};

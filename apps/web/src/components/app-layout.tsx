import { Outlet } from "react-router-dom";
import { useAuth } from "../providers/auth-context.js";
import { Button } from "./ui/button.js";
import { Sidebar } from "./sidebar.js";

export const AppLayout = () => {
  const { logout } = useAuth();

  return (
    <div className="flex min-h-screen gap-6 bg-background/95 px-6 py-8 text-foreground">
      <Sidebar />
      <main className="flex-1 space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.4em] text-slate-400">Realtime overview</p>
            <h2 className="text-3xl font-semibold text-white">Monitoring dashboard</h2>
          </div>
          <Button variant="ghost" onClick={logout}>
            Log out
          </Button>
        </header>
        <Outlet />
      </main>
    </div>
  );
};

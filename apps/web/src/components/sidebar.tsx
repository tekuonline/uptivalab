import type { ComponentType } from "react";
import { NavLink } from "react-router-dom";
import { Monitor, Bell, Activity, Settings, LayoutDashboard, Heart, Wrench } from "lucide-react";
import { useTranslation } from "../hooks/use-translation.js";
import type { TranslationKey } from "../lib/i18n.js";

type NavItem = {
  labelKey: TranslationKey;
  to: string;
  icon: ComponentType<{ className?: string }>;
};

const links: NavItem[] = [
  { labelKey: "dashboard", to: "/dashboard", icon: LayoutDashboard },
  { labelKey: "monitors", to: "/monitors", icon: Monitor },
  { labelKey: "heartbeats", to: "/heartbeats", icon: Heart },
  { labelKey: "notifications", to: "/notifications", icon: Bell },
  { labelKey: "incidents", to: "/incidents", icon: Activity },
  { labelKey: "statusPages", to: "/status-pages", icon: Settings },
  { labelKey: "maintenance", to: "/maintenance", icon: Wrench },
  { labelKey: "settings", to: "/settings", icon: Settings },
];

export const Sidebar = () => {
  const { t } = useTranslation();
  
  return (
    <aside className="glass-panel flex h-full w-64 flex-col rounded-3xl p-6">
      <div className="mb-10">
        <p className="text-xs uppercase tracking-[0.35em] text-slate-500 dark:text-slate-400">UptivaLab</p>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Command Center</h1>
      </div>
      <nav className="space-y-2">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition ${
                isActive ? "bg-slate-200 dark:bg-white/10 text-slate-900 dark:text-white" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`
            }
          >
            <link.icon className="h-5 w-5" />
            {t(link.labelKey)}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
};

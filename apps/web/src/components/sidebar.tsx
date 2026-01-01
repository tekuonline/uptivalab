import type { ComponentType } from "react";
import { NavLink } from "react-router-dom";
import { Monitor, Bell, Activity, Settings, LayoutDashboard, Heart, Wrench, X } from "lucide-react";
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

export const Sidebar = ({ isOpen, onClose }: { isOpen?: boolean; onClose?: () => void }) => {
  const { t } = useTranslation();
  
  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
        />
      )}
      
      {/* Sidebar */}
      <aside className={`
        glass-panel flex h-full w-64 flex-col rounded-3xl p-6
        fixed lg:sticky top-0 left-0 z-50 lg:z-auto
        transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        lg:h-auto lg:min-h-screen
      `}>
      {/* Mobile close button */}
      {isOpen && onClose && (
        <button
          onClick={onClose}
          className="absolute top-4 right-4 lg:hidden p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-white/10 transition"
          aria-label="Close menu"
        >
          <X className="h-5 w-5 text-slate-600 dark:text-slate-400" />
        </button>
      )}
      
      <div className="mb-10">
        <p className="text-xs uppercase tracking-[0.35em] text-slate-500 dark:text-slate-400">UptivaLab</p>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">{t("commandCenter")}</h1>
      </div>
      <nav className="space-y-2">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            onClick={onClose}
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
    </>
  );
};

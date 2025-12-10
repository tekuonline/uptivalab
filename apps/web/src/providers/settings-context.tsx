import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { initI18n } from "../lib/i18n.js";

interface Settings {
  displayTimezone?: string;
  serverTimezone?: string;
  searchEngineVisibility?: "allow" | "discourage";
  entryPage?: "dashboard" | "status";
  primaryBaseUrl?: string;
  steamApiKey?: string;
  enableNscd?: boolean;
  chromeExecutable?: string;
  language?: string;
  theme?: "auto" | "light" | "dark";
  heartbeatBarTheme?: "normal" | "bottom-up";
  showElapsedTime?: boolean;
  cloudflareTunnelToken?: string;
  cloudflaredInstalled?: boolean;
  cloudflaredRunning?: boolean;
  reverseProxyHeaders?: string;
  trustProxy?: boolean;
  checkUpdates?: boolean;
  checkBetaReleases?: boolean;
}

interface SettingsContextType {
  settings: Settings;
  loading: boolean;
  updateSettings: (newSettings: Partial<Settings>) => Promise<void>;
  refetchSettings: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const [settings, setSettings] = useState<Settings>({});
  const [loading, setLoading] = useState(true);

  const fetchSettings = async () => {
    try {
      const token = localStorage.getItem("uptivalab.token");
      if (!token) {
        setLoading(false);
        return;
      }

      const res = await fetch("/api/settings", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setSettings(data);
        
        // Apply theme immediately
        applyTheme(data.theme || "auto");
        
        // Apply language if set
        if (data.language) {
          initI18n(data.language);
        }
      }
    } catch (error) {
      console.error("Failed to fetch settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const applyTheme = (theme: string) => {
    const root = document.documentElement;
    
    if (theme === "auto") {
      // Check system preference
      const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      root.classList.toggle("dark", isDark);
      root.classList.toggle("light", !isDark);
    } else {
      root.classList.toggle("dark", theme === "dark");
      root.classList.toggle("light", theme === "light");
    }
  };

  const updateSettings = async (newSettings: Partial<Settings>) => {
    try {
      const token = localStorage.getItem("uptivalab.token");
      const res = await fetch("/api/settings/batch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newSettings),
      });

      if (res.ok) {
        setSettings((prev) => ({ ...prev, ...newSettings }));
        
        // Apply theme if changed
        if (newSettings.theme) {
          applyTheme(newSettings.theme);
        }
        
        // Apply language if changed
        if (newSettings.language) {
          initI18n(newSettings.language);
        }
      }
    } catch (error) {
      console.error("Failed to update settings:", error);
      throw error;
    }
  };

  const refetchSettings = async () => {
    setLoading(true);
    await fetchSettings();
  };

  useEffect(() => {
    fetchSettings();
    
    // Listen for system theme changes when in auto mode
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      if (settings.theme === "auto") {
        applyTheme("auto");
      }
    };
    
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [settings.theme]);

  return (
    <SettingsContext.Provider value={{ settings, loading, updateSettings, refetchSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
};

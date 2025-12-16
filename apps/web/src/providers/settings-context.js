import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext, useState, useEffect } from "react";
import { initI18n } from "../lib/i18n.js";
const SettingsContext = createContext(undefined);
export const SettingsProvider = ({ children }) => {
    const [settings, setSettings] = useState({});
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
        }
        catch (error) {
            console.error("Failed to fetch settings:", error);
        }
        finally {
            setLoading(false);
        }
    };
    const applyTheme = (theme) => {
        const root = document.documentElement;
        if (theme === "auto") {
            // Check system preference
            const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
            root.classList.toggle("dark", isDark);
            root.classList.toggle("light", !isDark);
        }
        else {
            root.classList.toggle("dark", theme === "dark");
            root.classList.toggle("light", theme === "light");
        }
    };
    const updateSettings = async (newSettings) => {
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
        }
        catch (error) {
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
    return (_jsx(SettingsContext.Provider, { value: { settings, loading, updateSettings, refetchSettings }, children: children }));
};
export const useSettings = () => {
    const context = useContext(SettingsContext);
    if (context === undefined) {
        throw new Error("useSettings must be used within a SettingsProvider");
    }
    return context;
};

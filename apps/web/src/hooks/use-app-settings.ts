import { useSettings } from "../providers/settings-context.js";

/**
 * Hook to access specific settings values with defaults
 */
export function useAppSettings() {
  const { settings } = useSettings();

  return {
    // General
    displayTimezone: settings.displayTimezone || "UTC",
    serverTimezone: settings.serverTimezone || "UTC",
    searchEngineVisibility: settings.searchEngineVisibility || "allow",
    entryPage: settings.entryPage || "dashboard",
    primaryBaseUrl: settings.primaryBaseUrl || "",
    steamApiKey: settings.steamApiKey || "",
    enableNscd: settings.enableNscd || false,
    chromeExecutable: settings.chromeExecutable || "",
    
    // Appearance
    language: settings.language || "en",
    theme: settings.theme || "auto",
    heartbeatBarTheme: settings.heartbeatBarTheme || "normal",
    showElapsedTime: settings.showElapsedTime !== false, // default true
    
    // Reverse Proxy
    cloudflareTunnelToken: settings.cloudflareTunnelToken || "",
    cloudflaredInstalled: settings.cloudflaredInstalled || false,
    cloudflaredRunning: settings.cloudflaredRunning || false,
    reverseProxyHeaders: settings.reverseProxyHeaders || "",
    trustProxy: settings.trustProxy || false,
    
    // About
    checkUpdates: settings.checkUpdates || false,
    checkBetaReleases: settings.checkBetaReleases || false,
  };
}

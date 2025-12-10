import { settingsService } from "../services/settings/service.js";

/**
 * Utility to get monitor configuration options from settings
 */
export class MonitorConfigHelper {
  /**
   * Get available Docker hosts for container monitoring
   */
  static async getDockerHosts() {
    return settingsService.getDockerHosts();
  }

  /**
   * Get available proxies for HTTP monitoring
   */
  static async getProxies() {
    return settingsService.getProxies();
  }

  /**
   * Get available remote browsers for browser-based monitoring
   */
  static async getRemoteBrowsers() {
    return settingsService.getRemoteBrowsers();
  }

  /**
   * Get Chrome executable path for screenshot monitoring
   */
  static async getChromeExecutable() {
    return settingsService.getChromeExecutable();
  }

  /**
   * Get Steam API key for Steam server monitoring
   */
  static async getSteamApiKey() {
    const key = await settingsService.get<string>("steamApiKey");
    return key || undefined;
  }

  /**
   * Get primary base URL for notification links
   */
  static async getPrimaryBaseUrl() {
    return settingsService.getPrimaryBaseUrl();
  }

  /**
   * Check if NSCD is enabled for DNS caching
   */
  static async isNscdEnabled() {
    return settingsService.isNscdEnabled();
  }

  /**
   * Get custom reverse proxy headers
   */
  static async getReverseProxyHeaders() {
    const headers = await settingsService.get<string>("reverseProxyHeaders");
    if (!headers) return {};

    // Parse headers from string format "Key: Value\nKey2: Value2"
    const headerLines = headers.split("\n").filter((line) => line.trim());
    const headerObj: Record<string, string> = {};

    for (const line of headerLines) {
      const [key, ...valueParts] = line.split(":");
      if (key && valueParts.length > 0) {
        headerObj[key.trim()] = valueParts.join(":").trim();
      }
    }

    return headerObj;
  }
}

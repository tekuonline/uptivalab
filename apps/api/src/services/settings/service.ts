import { prisma } from "../../db/prisma.js";

/**
 * Settings service to retrieve and cache application settings
 */
class SettingsService {
  private cache: Map<string, any> = new Map();
  private cacheExpiry: Map<string, number> = new Map();
  private readonly CACHE_TTL = 60000; // 1 minute

  /**
   * Get a setting value by key
   */
  async get<T = any>(key: string, defaultValue?: T): Promise<T | undefined> {
    // Check cache first
    if (this.cache.has(key)) {
      const expiry = this.cacheExpiry.get(key);
      if (expiry && expiry > Date.now()) {
        return this.cache.get(key) as T;
      }
    }

    // Fetch from database
    const setting = await prisma.setting.findUnique({
      where: { key },
    });

    const value = setting?.value as T;
    
    // Update cache
    if (value !== undefined) {
      this.cache.set(key, value);
      this.cacheExpiry.set(key, Date.now() + this.CACHE_TTL);
    }

    return value ?? defaultValue;
  }

  /**
   * Get all settings as a map
   */
  async getAll(): Promise<Record<string, any>> {
    const settings = await prisma.setting.findMany();
    return settings.reduce((acc: Record<string, any>, s: any) => {
      acc[s.key] = s.value;
      return acc;
    }, {} as Record<string, any>);
  }

  /**
   * Set a setting value
   */
  async set(key: string, value: any): Promise<void> {
    await prisma.setting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });

    // Update cache
    this.cache.set(key, value);
    this.cacheExpiry.set(key, Date.now() + this.CACHE_TTL);
  }

  /**
   * Clear cache for a specific key or all
   */
  clearCache(key?: string): void {
    if (key) {
      this.cache.delete(key);
      this.cacheExpiry.delete(key);
    } else {
      this.cache.clear();
      this.cacheExpiry.clear();
    }
  }

  /**
   * Get Chrome/Chromium executable path
   */
  async getChromeExecutable(): Promise<string | undefined> {
    return this.get<string>("chromeExecutable");
  }

  /**
   * Get all Docker hosts
   */
  async getDockerHosts(): Promise<Array<{ id: string; name: string; url: string }>> {
    const hosts = await this.get<any[]>("dockerHosts", []);
    return hosts || [];
  }

  /**
   * Get all proxies
   */
  async getProxies(): Promise<Array<{
    id: string;
    name: string;
    protocol: string;
    host: string;
    port: number;
    auth?: { username: string; password: string };
  }>> {
    const proxies = await this.get<any[]>("proxies", []);
    return proxies || [];
  }

  /**
   * Get all remote browsers
   */
  async getRemoteBrowsers(): Promise<Array<{ id: string; name: string; url: string }>> {
    const browsers = await this.get<any[]>("remoteBrowsers", []);
    return browsers || [];
  }

  /**
   * Get display timezone
   */
  async getDisplayTimezone(): Promise<string> {
    const tz = await this.get<string>("displayTimezone", "UTC");
    return tz || "UTC";
  }

  /**
   * Get server timezone
   */
  async getServerTimezone(): Promise<string> {
    const tz = await this.get<string>("serverTimezone", "UTC");
    return tz || "UTC";
  }

  /**
   * Check if NSCD is enabled
   */
  async isNscdEnabled(): Promise<boolean> {
    const enabled = await this.get<boolean>("enableNscd", false);
    return enabled || false;
  }

  /**
   * Get Steam API key
   */
  async getSteamApiKey(): Promise<string | undefined> {
    return this.get<string>("steamApiKey");
  }

  /**
   * Get primary base URL
   */
  async getPrimaryBaseUrl(): Promise<string | undefined> {
    return this.get<string>("primaryBaseUrl");
  }

  /**
   * Check if proxy should be trusted
   */
  async shouldTrustProxy(): Promise<boolean> {
    const trust = await this.get<boolean>("trustProxy", false);
    return trust || false;
  }

  /**
   * Get reverse proxy headers
   */
  async getReverseProxyHeaders(): Promise<string | undefined> {
    return this.get<string>("reverseProxyHeaders");
  }
}

// Export singleton instance
export const settingsService = new SettingsService();

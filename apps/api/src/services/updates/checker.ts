import { settingsService } from "../settings/service.js";

interface VersionInfo {
  current: string;
  latest: string;
  latestBeta?: string;
  updateAvailable: boolean;
  betaAvailable: boolean;
  releaseUrl?: string;
}

class UpdateChecker {
  private cachedVersion: VersionInfo | null = null;
  private lastCheck: number = 0;
  private readonly CACHE_TTL = 3600000; // 1 hour
  private readonly CURRENT_VERSION = "2.0.2";

  /**
   * Check for available updates
   */
  async checkForUpdates(): Promise<VersionInfo> {
    const checkUpdates = await settingsService.get<boolean>("checkUpdates", false);
    const checkBeta = await settingsService.get<boolean>("checkBetaReleases", false);

    // Return cached if available and not expired
    if (this.cachedVersion && Date.now() - this.lastCheck < this.CACHE_TTL) {
      return this.cachedVersion;
    }

    // If update checking is disabled, return current version
    if (!checkUpdates) {
      return {
        current: this.CURRENT_VERSION,
        latest: this.CURRENT_VERSION,
        updateAvailable: false,
        betaAvailable: false,
      };
    }

    try {
      // Fetch latest version from GitHub API
      const response = await fetch("https://api.github.com/repos/yourusername/uptivalab/releases");
      
      if (!response.ok) {
        throw new Error("Failed to fetch releases");
      }

      const releases = await response.json();
      
      // Find latest stable release
      const stableReleases = releases.filter((r: any) => !r.prerelease && !r.draft);
      const latestStable = stableReleases[0];
      
      let latestBeta = undefined;
      let betaAvailable = false;
      
      if (checkBeta) {
        const betaReleases = releases.filter((r: any) => r.prerelease && !r.draft);
        if (betaReleases.length > 0) {
          latestBeta = betaReleases[0].tag_name.replace(/^v/, "");
          betaAvailable = this.compareVersions(latestBeta, this.CURRENT_VERSION) > 0;
        }
      }

      const latestVersion = latestStable?.tag_name.replace(/^v/, "") || this.CURRENT_VERSION;
      const updateAvailable = this.compareVersions(latestVersion, this.CURRENT_VERSION) > 0;

      this.cachedVersion = {
        current: this.CURRENT_VERSION,
        latest: latestVersion,
        latestBeta,
        updateAvailable,
        betaAvailable,
        releaseUrl: latestStable?.html_url,
      };

      this.lastCheck = Date.now();
      return this.cachedVersion;

    } catch (error) {
      console.error("Failed to check for updates:", error);
      
      // Return current version on error
      return {
        current: this.CURRENT_VERSION,
        latest: this.CURRENT_VERSION,
        updateAvailable: false,
        betaAvailable: false,
      };
    }
  }

  /**
   * Compare two semantic versions
   * Returns: 1 if a > b, -1 if a < b, 0 if equal
   */
  private compareVersions(a: string, b: string): number {
    const aParts = a.split(".").map(Number);
    const bParts = b.split(".").map(Number);

    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
      const aVal = aParts[i] || 0;
      const bVal = bParts[i] || 0;

      if (aVal > bVal) return 1;
      if (aVal < bVal) return -1;
    }

    return 0;
  }

  /**
   * Clear cached version info
   */
  clearCache(): void {
    this.cachedVersion = null;
    this.lastCheck = 0;
  }
}

export const updateChecker = new UpdateChecker();

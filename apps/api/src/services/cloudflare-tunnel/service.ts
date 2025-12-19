import { exec, spawn, ChildProcess } from "child_process";
import { promisify } from "util";
import { prisma } from "../../db/prisma.js";
import { settingsService } from "../settings/service.js";

const execAsync = promisify(exec);

/**
 * Service to manage Cloudflare Tunnel (cloudflared) process
 */
class CloudflareTunnelService {
  private cloudflaredProcess: ChildProcess | null = null;
  private isRunning = false;
  private token: string | null = null;

  /**
   * Check if cloudflared is installed
   */
  async isInstalled(): Promise<boolean> {
    try {
      await execAsync("which cloudflared");
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the current tunnel token from settings
   */
  async getToken(): Promise<string | null> {
    // Bypass cache for token to ensure we get the latest value
    const setting = await prisma.setting.findUnique({
      where: { key: "cloudflareTunnelToken" },
    });
    const token = setting?.value as string;
    // Return null if token is empty or null
    return token && token.trim() ? token : null;
  }

  /**
   * Start cloudflared tunnel
   */
  async start(): Promise<{ success: boolean; message: string }> {
    try {
      // Check if already running
      if (this.isRunning && this.cloudflaredProcess) {
        return { success: false, message: "Cloudflare Tunnel is already running" };
      }

      // Check if cloudflared is installed
      const installed = await this.isInstalled();
      if (!installed) {
        return { success: false, message: "cloudflared is not installed in the container" };
      }

      // Get token from settings
      const token = await this.getToken();
      if (!token) {
        return { success: false, message: "No Cloudflare Tunnel token configured" };
      }

      // Store token
      this.token = token;

      // Start cloudflared process
      this.cloudflaredProcess = spawn("cloudflared", [
        "tunnel",
        "--no-autoupdate",
        "--protocol",
        "http2",
        "run",
        "--token",
        token,
      ], {
        stdio: ["ignore", "pipe", "pipe"],
        detached: false,
      });

      // Handle stdout
      this.cloudflaredProcess.stdout?.on("data", (data) => {
        const output = data.toString().trim();
        if (output.includes("ERR") || output.includes("Registered")) {
          console.log(`[cloudflared] ${output}`);
        }
      });

      // Handle stderr
      this.cloudflaredProcess.stderr?.on("data", (data) => {
        console.error(`[cloudflared] ${data.toString().trim()}`);
      });

      // Handle process exit
      this.cloudflaredProcess.on("exit", (code, signal) => {
        this.isRunning = false;
        this.cloudflaredProcess = null;
      });

      // Handle errors
      this.cloudflaredProcess.on("error", (error) => {
        console.error(`[cloudflared] Process error:`, error);
        this.isRunning = false;
        this.cloudflaredProcess = null;
      });

      // Mark as running
      this.isRunning = true;

      // Give it a moment to start
      await new Promise((resolve) => setTimeout(resolve, 1000));

      return { success: true, message: "Cloudflare Tunnel started successfully" };
    } catch (error) {
      console.error("Failed to start cloudflared:", error);
      return {
        success: false,
        message: error instanceof Error ? error.message : "Failed to start tunnel",
      };
    }
  }

  /**
   * Stop cloudflared tunnel
   */
  async stop(): Promise<{ success: boolean; message: string }> {
    try {
      if (!this.cloudflaredProcess || !this.isRunning) {
        return { success: false, message: "Cloudflare Tunnel is not running" };
      }

      // Kill the process
      this.cloudflaredProcess.kill("SIGTERM");

      // Wait for it to exit
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Force kill if still running
      if (this.isRunning) {
        this.cloudflaredProcess.kill("SIGKILL");
      }

      this.isRunning = false;
      this.cloudflaredProcess = null;
      this.token = null;

      return { success: true, message: "Cloudflare Tunnel stopped successfully" };
    } catch (error) {
      console.error("Failed to stop cloudflared:", error);
      return {
        success: false,
        message: error instanceof Error ? error.message : "Failed to stop tunnel",
      };
    }
  }

  /**
   * Restart cloudflared tunnel
   */
  async restart(): Promise<{ success: boolean; message: string }> {
    await this.stop();
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return await this.start();
  }

  /**
   * Get current status
   */
  getStatus(): { running: boolean; installed: boolean } {
    return {
      running: this.isRunning,
      installed: true, // We'll check this async when needed
    };
  }

  /**
   * Initialize - auto-start if token exists
   */
  async initialize(): Promise<void> {
    try {
      const token = await this.getToken();
      if (token) {
        const result = await this.start();
        if (!result.success) {
          console.error("Failed to start Cloudflare Tunnel:", result.message);
        }
      }
    } catch (error) {
      console.error("Failed to initialize Cloudflare Tunnel:", error);
    }
  }
}

// Export singleton instance
export const cloudflareTunnel = new CloudflareTunnelService();

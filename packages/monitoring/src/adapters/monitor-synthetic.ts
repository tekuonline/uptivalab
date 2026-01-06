import { chromium, firefox, webkit, type BrowserType, type Page, type Browser } from "playwright-core";
import type {
  BaseMonitor,
  MonitorAdapter,
  MonitorResult,
  SyntheticConfig,
  SyntheticStep,
  MonitorResultMeta,
} from "../types.js";

const browsers: Record<string, BrowserType> = {
  chromium,
  firefox,
  webkit,
};

const toConfig = (config: Record<string, unknown>): SyntheticConfig => {
  const steps = Array.isArray(config.steps) ? (config.steps as SyntheticStep[]) : [];
  if (!steps.length) {
    throw new Error("Synthetic monitor requires steps");
  }
  return {
    steps,
    browser: (config.browser as SyntheticConfig["browser"]) ?? "chromium",
    baseUrl: typeof config.baseUrl === "string" ? config.baseUrl : undefined,
    remoteBrowserId: typeof config.remoteBrowserId === "string" ? config.remoteBrowserId : undefined,
    useLocalBrowser: typeof config.useLocalBrowser === "boolean" ? config.useLocalBrowser : false,
  };
};

// Helper to get remote browser WebSocket endpoint
const getRemoteBrowserEndpoint = async (remoteBrowserId?: string): Promise<string | null> => {
  try {
    // Get remote browsers from environment or settings
    const playwrightWsEndpoint = process.env.PLAYWRIGHT_WS_ENDPOINT;
    
    // If no specific browser ID requested, use default endpoint from environment
    if (!remoteBrowserId) {
      return playwrightWsEndpoint || null;
    }
    
    // For now, return the default endpoint even if browser ID is specified
    // In the future, this could fetch from database based on remoteBrowserId
    return playwrightWsEndpoint || null;
  } catch (error) {
    console.error("Failed to get remote browser endpoint:", error);
    return null;
  }
};

// Helper to connect to browser (embedded local or remote)
const connectToBrowser = async (
  config: SyntheticConfig,
  launchTimeout: number
): Promise<{ browser: Browser; isRemote: boolean }> => {
  const browserType = browsers[config.browser ?? "chromium"] ?? chromium;
  
  // Check if USE_REMOTE_BROWSER env is explicitly set to force remote browser
  const forceRemote = process.env.USE_REMOTE_BROWSER === 'true';
  
  // Use local embedded browser by default (unless remote is forced or explicitly requested)
  if (!forceRemote && config.useLocalBrowser !== false) {
    try {
      const browser = await browserType.launch({ 
        headless: true, 
        timeout: launchTimeout,
        // Playwright will use PLAYWRIGHT_BROWSERS_PATH env var automatically
      });
      return { browser, isRemote: false };
    } catch (error) {
      console.warn("Failed to launch local browser, trying remote fallback:", error);
      // Fall through to try remote browser
    }
  }
  
  // Try remote browser if local fails or is explicitly disabled
  const wsEndpoint = await getRemoteBrowserEndpoint(config.remoteBrowserId);
  
  if (wsEndpoint) {
    // Retry connecting to remote browser
    const maxRetries = 3;
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const browser = await browserType.connect(wsEndpoint, { timeout: launchTimeout });
        return { browser, isRemote: true };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Wait before retry (except on last attempt)
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
    }
    
    throw new Error(
      `Failed to connect to remote Playwright browser after ${maxRetries} attempts. ` +
      `Last error: ${lastError?.message}. Please ensure the Playwright service is running or disable remote browser mode.`
    );
  }
  
  // No remote browser available
  throw new Error(
    "No browser available. Local browser failed and no remote browser endpoint configured. " +
    "Please check that Playwright browsers are installed or configure PLAYWRIGHT_WS_ENDPOINT."
  );
};

export const syntheticAdapter: MonitorAdapter = {
  kind: "synthetic",
  supports: () => true,
  async execute(monitor: BaseMonitor): Promise<MonitorResult> {
    const config = toConfig(monitor.config);
    const launchTimeout = monitor.timeout ?? 30000;

  const journeySteps: NonNullable<MonitorResultMeta["journeySteps"]> = [];
    const start = Date.now();

    try {
      const { browser, isRemote } = await connectToBrowser(config, launchTimeout);
      const context = await browser.newContext();
      const page = await context.newPage();

      for (const step of config.steps) {
        const label = step.action.toUpperCase();
        try {
          await runStep(page, step, config.baseUrl);
          journeySteps.push({ label, status: "up" });
        } catch (error) {
          journeySteps.push({
            label,
            status: "down",
            detail: error instanceof Error ? error.message : String(error),
          });
          await browser.close();
          return {
            monitorId: monitor.id,
            status: "down",
            message: `Synthetic step failed: ${label}`,
            checkedAt: new Date().toISOString(),
            meta: { journeySteps },
          };
        }
      }

      await browser.close();
      
      const browserInfo = isRemote ? " (remote)" : " (local)";
      return {
        monitorId: monitor.id,
        status: "up",
        message: `Synthetic journey ok (${Date.now() - start}ms)${browserInfo}` ,
        checkedAt: new Date().toISOString(),
        meta: { journeySteps },
      };
    } catch (error) {
      return {
        monitorId: monitor.id,
        status: "down",
        message: error instanceof Error ? error.message : String(error),
        checkedAt: new Date().toISOString(),
        meta: { journeySteps },
      };
    }
  },
};

const runStep = async (page: Page, step: SyntheticStep, baseUrl?: string) => {
  switch (step.action) {
    case "goto":
      if (!step.url && !baseUrl) throw new Error("goto requires url or baseUrl");
      await page.goto(step.url ?? baseUrl!, { timeout: step.timeout ?? 15000 });
      return;
    case "click":
      if (!step.selector) throw new Error("click requires selector");
      await page.click(step.selector, { timeout: step.timeout ?? 15000 });
      return;
    case "fill":
      if (!step.selector) throw new Error("fill requires selector");
      await page.fill(step.selector, step.value ?? "", { timeout: step.timeout ?? 15000 });
      return;
    case "expect":
      if (step.text) {
        await page.waitForTimeout(50);
        await page.waitForSelector(`text=${step.text}`, { timeout: step.timeout ?? 15000 });
      } else if (step.selector) {
        await page.waitForSelector(step.selector, { timeout: step.timeout ?? 15000 });
      } else {
        throw new Error("expect requires text or selector");
      }
      return;
    case "wait":
      await page.waitForTimeout(step.timeout ?? 1000);
      return;
    default:
      throw new Error(`Unknown action ${step.action}`);
  }
};
